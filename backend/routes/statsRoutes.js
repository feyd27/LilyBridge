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
          totalBytes:        { $sum: '$payloadSize'     },
          totalReadings:     { $sum: '$readingCount'    },
          avgReadings:       { $avg: '$readingCount'    },
          avgTimeToConfirm:  { $avg: { $subtract: ['$confirmedAt', '$startTime'] } },
          totalCost:         { $sum: '$fee'             },
          durations:         { $push: '$elapsedTime'     }
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
          durations: 1
        }
      }
    ]);

    // If no records yet, return zeros/empty
    if (!stats) {
      return res.json({
        totalDataKB: 0,
        totalReadings: 0,
        avgReadingsPerUpload: 0,
        avgTimeToConfirmMs: 0,
        totalCost: 0,
        avgCostPerReading: 0,
        durations: []
      });
    }

    res.json(stats);
  } catch (err) {
    console.error('[Stats] Error computing Signum upload stats:', err);
    res.status(500).json({ error: 'Failed to fetch Signum upload statistics' });
  }
});

module.exports = router;
