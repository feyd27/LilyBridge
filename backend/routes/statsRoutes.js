// routes/statsRoutes.js
const express         = require('express');
const router          = express.Router();
const authMiddleware  = require('../middleware/authMiddleware');
const UploadedMessage = require('../models/uploadedMessage');

/**
 * @swagger
 * /stats/signum/uploads:
 *   get:
 *     summary: Retrieve upload statistics for Signum
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signum upload statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDataKB:
 *                   type: number
 *                   description: Total uploaded data in kilobytes
 *                 totalReadings:
 *                   type: integer
 *                   description: Total number of readings uploaded
 *                 avgReadingsPerUpload:
 *                   type: number
 *                   description: Average number of readings per upload
 *                 avgTimeToConfirmMs:
 *                   type: number
 *                   description: Average time from submission to confirmation in milliseconds
 *                 totalCost:
 *                   type: number
 *                   description: Total fees paid (in Planck)
 *                 avgCostPerReading:
 *                   type: number
 *                   description: Average cost per reading
 *                 durations:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: Array of upload durations (elapsedTime) in milliseconds
 *       500:
 *         description: Server error
 */
router.get('/signum/uploads', authMiddleware, async (req, res) => {
  try {
    const [stats] = await UploadedMessage.aggregate([
      { $match: { blockchain: 'SIGNUM' } },
      {
        $group: {
          _id: null,
          // existing metrics
          totalBytes:    { $sum: '$payloadSize'  },
          totalReadings: { $sum: '$readingCount' },
          avgReadings:   { $avg: '$readingCount' },
          totalCost:     { $sum: '$fee'          },
          durations:     { $push: '$elapsedTime' },

          // average time from submission to confirmation (ms) – only for confirmed rows
          avgTimeToConfirm: {
            $avg: {
              $cond: [
                { $and: [
                  { $ne: ['$confirmedAt', null] },
                  { $ne: ['$sentAt', null] }
                ]},
                { $subtract: ['$confirmedAt', '$sentAt'] },
                null // ignored by $avg
              ]
            }
          },

          // NEW: counts by state
          pendingCount: {
            $sum: {
              $cond: [
                // prefer boolean flag if present; otherwise fall back to status text
                {
                  $or: [
                    { $eq: ['$confirmed', false] },
                    { $in: ['$status', ['pending', 'PENDING', 'Sent', 'SENT']] }
                  ]
                },
                1, 0
              ]
            }
          },
          confirmedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$confirmed', true] },
                    { $in: ['$status', ['confirmed', 'CONFIRMED']] }
                  ]
                },
                1, 0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalDataKB:          { $divide: ['$totalBytes', 1024] },
          totalReadings:        1,
          avgReadingsPerUpload: '$avgReadings',
          avgTimeToConfirmMs:   '$avgTimeToConfirm',
          totalCost:            1,
          avgCostPerReading: {
            $cond: [
              { $gt: ['$totalReadings', 0] },
              { $divide: ['$totalCost', '$totalReadings'] },
              0
            ]
          },
          durations: 1,
          // NEW: expose the counts
          pendingCount:   1,
          confirmedCount: 1
        }
      }
    ]);

    if (!stats) {
      return res.json({
        totalDataKB: 0,
        totalReadings: 0,
        avgReadingsPerUpload: 0,
        avgTimeToConfirmMs: 0,
        totalCost: 0,
        avgCostPerReading: 0,
        durations: [],
        pendingCount: 0,
        confirmedCount: 0
      });
    }

    res.json(stats);
  } catch (err) {
    console.error('[Stats] Error computing Signum upload stats:', err);
    res.status(500).json({ error: 'Failed to fetch Signum upload statistics' });
  }
});

/**
 * @swagger
 * /stats/iota/uploads:
 *   get:
 *     summary: Retrieve upload statistics for IOTA
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: IOTA upload statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalDataKB:
 *                   type: number
 *                   description: Total uploaded data in kilobytes
 *                 totalReadings:
 *                   type: integer
 *                   description: Total number of readings uploaded
 *                 avgReadingsPerUpload:
 *                   type: number
 *                   description: Average number of readings per upload
 *                 avgTimeToConfirmMs:
 *                   type: number
 *                   description: Average upload elapsed time in milliseconds
 *                 totalCost:
 *                   type: number
 *                   description: Always 0 for IOTA (fees not tracked)
 *                 avgCostPerReading:
 *                   type: number
 *                   description: Always 0 for IOTA (fees not tracked)
 *                 durations:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: Array of upload durations (elapsedTime) in milliseconds
 *                 pendingCount:
 *                   type: integer
 *                   description: Always 0 for IOTA (no pending concept)
 *                 confirmedCount:
 *                   type: integer
 *                   description: Number of IOTA upload records
 *       500:
 *         description: Server error
 */
router.get('/iota/uploads', authMiddleware, async (req, res) => {
  try {
    const [stats] = await UploadedMessage.aggregate([
      { $match: { blockchain: 'IOTA' } },
      {
        $group: {
          _id: null,
          uploadsCount: { $sum: 1 },
          totalBytes:   { $sum: '$payloadSize'  },
          totalReadings:{ $sum: '$readingCount' },
          avgReadings:  { $avg: '$readingCount' },
          durations:    { $push: '$elapsedTime' },
          avgElapsed:   { $avg: '$elapsedTime' } // use stored elapsedTime as “confirm time”
        }
      },
      {
        $project: {
          _id: 0,
          totalDataKB:          { $divide: ['$totalBytes', 1024] },
          totalReadings:        1,
          avgReadingsPerUpload: '$avgReadings',
          avgTimeToConfirmMs:   '$avgElapsed',
          durations:            1,
          // Fees/pending are always zero for IOTA to keep parity with Signum response shape
          totalCost:            { $literal: 0 },
          avgCostPerReading:    { $literal: 0 },
          pendingCount:         { $literal: 0 },
          confirmedCount:       '$uploadsCount'
        }
      }
    ]);

    if (!stats) {
      return res.json({
        totalDataKB: 0,
        totalReadings: 0,
        avgReadingsPerUpload: 0,
        avgTimeToConfirmMs: 0,
        totalCost: 0,
        avgCostPerReading: 0,
        durations: [],
        pendingCount: 0,
        confirmedCount: 0
      });
    }

    res.json(stats);
  } catch (err) {
    console.error('[Stats] Error computing IOTA upload stats:', err);
    res.status(500).json({ error: 'Failed to fetch IOTA upload statistics' });
  }
});
module.exports = router;
