// routes/statsRoutes.js
const express         = require('express');
const router          = express.Router();
const logger          = require('../services/logger');
const authMiddleware  = require('../middleware/authMiddleware');
const UploadedMessage = require('../models/uploadedMessage');
const UploadAttempt = require('../models/uploadAttempt');
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
 *                 totalDataKB: { type: number, description: Total uploaded data in kilobytes }
 *                 totalReadings: { type: integer, description: Total number of readings uploaded }
 *                 avgReadingsPerUpload: { type: number, description: Average number of readings per upload }
 *                 avgTimeToConfirmMs: { type: number, description: Average time from submission to confirmation (ms) }
 *                 p50TimeToConfirmMs: { type: number, description: Median time from submission to confirmation (ms) }
 *                 p95TimeToConfirmMs: { type: number, description: 95th percentile time from submission to confirmation (ms) }
 *                 totalCost: { type: number, description: Total fees paid (in Planck) }
 *                 avgCostPerReading: { type: number, description: Average cost per reading }
 *                 durations:
 *                   type: array
 *                   items: { type: number }
 *                   description: Array of submit→201 durations (ms)
 *                 pendingCount: { type: integer }
 *                 confirmedCount: { type: integer }
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

          // totals
          totalBytes:    { $sum: '$payloadSize'  },
          totalReadings: { $sum: '$readingCount' },
          avgReadings:   { $avg: '$readingCount' },
          totalCost:     { $sum: '$fee'          },

          // build confirmation latencies: confirmedAt - (sentAt || startTime)
          confirmDurations: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$confirmedAt', null] },
                    {
                      $ne: [
                        { $ifNull: ['$sentAt', '$startTime'] },
                        null
                      ]
                    }
                  ]
                },
                {
                  $subtract: [
                    '$confirmedAt',
                    { $ifNull: ['$sentAt', '$startTime'] }
                  ]
                },
                null
              ]
            }
          },

          // counts by state
          pendingCount: {
            $sum: {
              $cond: [
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

      // filter out nulls once and reuse
      {
        $project: {
          _id: 0,
          totalDataKB:          { $divide: ['$totalBytes', 1024] },
          totalReadings:        1,
          avgReadingsPerUpload: '$avgReadings',
          totalCost:            { $divide: ['$totalCost', 100000000] },
          pendingCount:         1,
          confirmedCount:       1,
          avgCostPerReading: {
            $cond: [
              { $gt: ['$totalReadings', 0] },
              { $divide: [ { $divide: ['$totalCost', 100000000] }, '$totalReadings'] },
              0
            ]
          },
          _filtered: {
            $filter: {
              input: '$confirmDurations',
              as: 'd',
              cond: { $ne: ['$$d', null] }
            }
          }
        }
      },

      // compute avg / p50 / p95 from filtered latencies; also expose as durations
      {
        $project: {
          totalDataKB:          1,
          totalReadings:        1,
          avgReadingsPerUpload: 1,
          totalCost:            1,
          avgCostPerReading:    1,
          pendingCount:         1,
          confirmedCount:       1,

          // <-- durations now are confirm latencies, not elapsedTime
          durations: '$_filtered',

          avgTimeToConfirmMs: {
            $cond: [
              { $gt: [{ $size: '$_filtered' }, 0] },
              { $avg: '$_filtered' },
              0
            ]
          },

          p95TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n:      { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $arrayElemAt: [
                      '$$sorted',
                      {
                        $toInt: {
                          $floor: {
                            $multiply: [0.95, { $subtract: ['$$n', 1] }]
                          }
                        }
                      }
                    ]
                  },
                  0
                ]
              }
            }
          },

          p50TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n:      { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $let: {
                      vars: {
                        lower: {
                          $toInt: {
                            $floor: { $divide: [{ $subtract: ['$$n', 1] }, 2] }
                          }
                        },
                        upper: {
                          $toInt: { $floor: { $divide: ['$$n', 2] } }
                        }
                      },
                      in: {
                        $avg: [
                          { $arrayElemAt: ['$$sorted', '$$lower'] },
                          { $arrayElemAt: ['$$sorted', '$$upper'] }
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      }
    ]);

    if (!stats) {
      return res.json({
        totalDataKB: 0,
        totalReadings: 0,
        avgReadingsPerUpload: 0,
        avgTimeToConfirmMs: 0,
        p50TimeToConfirmMs: 0,
        p95TimeToConfirmMs: 0,
        totalCost: 0,
        avgCostPerReading: 0,
        durations: [],
        pendingCount: 0,
        confirmedCount: 0
      });
    }

    res.json(stats);
  } catch (err) {
    logger.error('[Stats] Error computing Signum upload stats:', err);
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
 *                 p50TimeToConfirmMs:
 *                   type: number
 *                   description: Median upload elapsed time in milliseconds
 *                 p95TimeToConfirmMs:
 *                   type: number
 *                   description: 95th percentile upload elapsed time in milliseconds
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
          avgElapsed:   { $avg: '$elapsedTime' } // mean of elapsedTime
        }
      },
      // Filter nulls out of durations so percentiles are robust
      {
        $project: {
          _id: 0,
          uploadsCount: 1,
          totalBytes:   1,
          totalReadings:1,
          avgReadings:  1,
          durations:    1,
          avgElapsed:   1,
          _filtered: {
            $filter: {
              input: '$durations',
              as: 'd',
              cond: { $ne: ['$$d', null] }
            }
          }
        }
      },
      // Compute avg/p50/p95 on filtered durations
      {
        $project: {
          totalDataKB:          { $divide: ['$totalBytes', 1024] },
          totalReadings:        1,
          avgReadingsPerUpload: '$avgReadings',
          durations:            '$durations',

          avgTimeToConfirmMs: {
            $cond: [
              { $gt: [{ $size: '$_filtered' }, 0] },
              { $avg: '$_filtered' },
              0
            ]
          },

          p95TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n:      { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $arrayElemAt: [
                      '$$sorted',
                      {
                        $toInt: {
                          $floor: {
                            $multiply: [0.95, { $subtract: ['$$n', 1] }]
                          }
                        }
                      }
                    ]
                  },
                  0
                ]
              }
            }
          },

          p50TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n:      { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $let: {
                      vars: {
                        lower: {
                          $toInt: {
                            $floor: { $divide: [{ $subtract: ['$$n', 1] }, 2] }
                          }
                        },
                        upper: {
                          $toInt: { $floor: { $divide: ['$$n', 2] } }
                        }
                      },
                      in: {
                        $avg: [
                          { $arrayElemAt: ['$$sorted', '$$lower'] },
                          { $arrayElemAt: ['$$sorted', '$$upper'] }
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          },

          // Parity fields
          totalCost:         { $literal: 0 },
          avgCostPerReading: { $literal: 0 },
          pendingCount:      { $literal: 0 },
          confirmedCount:    '$uploadsCount'
        }
      }
    ]);

    if (!stats) {
      return res.json({
        totalDataKB: 0,
        totalReadings: 0,
        avgReadingsPerUpload: 0,
        avgTimeToConfirmMs: 0,
        p50TimeToConfirmMs: 0,
        p95TimeToConfirmMs: 0,
        totalCost: 0,
        avgCostPerReading: 0,
        durations: [],
        pendingCount: 0,
        confirmedCount: 0
      });
    }

    res.json(stats);
  } catch (err) {
    logger.error('[Stats] Error computing IOTA upload stats:', err);
    res.status(500).json({ error: 'Failed to fetch IOTA upload statistics' });
  }
});

/**
 * @swagger
 * /stats/failures:
 *   get:
 *     summary: List failed upload attempts (IOTA & Signum)
 *     tags:
 *       - Stats
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: blockchain
 *         schema:
 *           type: string
 *           enum: [IOTA, SIGNUM]
 *         description: Filter by blockchain
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by user id (ObjectId as string)
 *       - in: query
 *         name: errorType
 *         schema:
 *           type: string
 *         description: Filter by error type (e.g., HttpError, MongoServerError)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Include attempts at/after this timestamp
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Include attempts at/before this timestamp
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [10, 25, 50, 100]
 *           default: 25
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [occurredAt, payloadSize, readingCount, attemptNo]
 *           default: occurredAt
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Page of failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 sort:
 *                   type: object
 *                   properties:
 *                     by:
 *                       type: string
 *                     dir:
 *                       type: string
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       occurredAt:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: string
 *                       blockchain:
 *                         type: string
 *                       correlationId:
 *                         type: string
 *                       attemptNo:
 *                         type: integer
 *                       tag:
 *                         type: string
 *                       nodeUrl:
 *                         type: string
 *                       nodeHost:
 *                         type: string
 *                       feePlanck:
 *                         type: number
 *                       txId:
 *                         type: string
 *                       payloadHash:
 *                         type: string
 *                       payloadSize:
 *                         type: integer
 *                       readingCount:
 *                         type: integer
 *                       httpStatusReturned:
 *                         type: integer
 *                       errorType:
 *                         type: string
 *                       errorCode:
 *                         type: string
 *                       errorMessage:
 *                         type: string
 *       500:
 *         description: Server error
 */

router.get('/failures', authMiddleware, async (req, res) => {
  try {
    const {
      blockchain,
      user,
      errorType,
      from,
      to,
      page   = '1',
      limit  = '25',
      sortBy = 'occurredAt',
      sortDir= 'desc',
    } = req.query;

    // pagination
    const allowedLimits = new Set([10, 25, 50, 100]);
    const limitNum = allowedLimits.has(Number(limit)) ? Number(limit) : 25;
    const pageNum  = Math.max(parseInt(page, 10) || 1, 1);

    // filters
    const q = {};
    if (blockchain) q.blockchain = blockchain;
    if (user)       q.user = user;
    if (errorType)  q.errorType = errorType;

    // date range
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate   = to   ? new Date(to)   : null;
      q.occurredAt = {};
      if (fromDate && !isNaN(fromDate)) q.occurredAt.$gte = fromDate;
      if (toDate   && !isNaN(toDate))   q.occurredAt.$lte = toDate;
      if (Object.keys(q.occurredAt).length === 0) delete q.occurredAt;
    }

    // sorting
    const sortable = new Set(['occurredAt', 'payloadSize', 'readingCount', 'attemptNo']);
    const sortField = sortable.has(sortBy) ? sortBy : 'occurredAt';
    const sort = { [sortField]: sortDir === 'asc' ? 1 : -1 };

    const totalItems = await UploadAttempt.countDocuments(q);

    const items = await UploadAttempt.find(q)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select(
        'occurredAt user blockchain correlationId attemptNo tag nodeUrl nodeHost feePlanck txId payloadHash payloadSize readingCount httpStatusReturned errorType errorCode errorMessage'
      )
      .lean();

    return res.json({
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limitNum)),
      currentPage: pageNum,
      limit: limitNum,
      sort: { by: sortField, dir: sortDir === 'asc' ? 'asc' : 'desc' },
      items
    });
  } catch (err) {
    logger.error('[Stats] /stats/failures error:', err);
    return res.status(500).json({ error: 'Failed to fetch failed attempts' });
  }
});

/**
 * @swagger
 * /stats/signum/uploads/daily:
 *   get:
 *     summary: Daily Signum upload statistics (grouped by tag date)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of daily aggregates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, example: "2025-08-06" }
 *                   uploads: { type: integer }
 *                   totalDataKB: { type: number }
 *                   totalReadings: { type: integer }
 *                   avgReadingsPerUpload: { type: number }
 *                   avgTimeToConfirmMs: { type: number }
 *                   p50TimeToConfirmMs: { type: number }
 *                   p95TimeToConfirmMs: { type: number }
 *                   durations:
 *                     type: array
 *                     items: { type: number }
 *                   totalCost: { type: number }
 *                   avgCostPerReading: { type: number }
 *                   pendingCount: { type: integer }
 *                   confirmedCount: { type: integer }
 *       500:
 *         description: Server error
 */
router.get('/signum/uploads/daily', authMiddleware, async (_req, res) => {
  try {
    const daily = await UploadedMessage.aggregate([
      { $match: { blockchain: 'SIGNUM' } },
      {
        $addFields: {
          _tagMatch: { $regexFind: { input: '$index', regex: /_(\d{2})(\d{2})(\d{4})$/ } }
        }
      },
      {
        $addFields: {
          _dateFromTag: {
            $cond: [
              {
                $and: [
                  { $ne: ['$_tagMatch', null] },
                  { $gt: [{ $size: { $ifNull: ['$_tagMatch.captures', []] } }, 0] }
                ]
              },
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      { $arrayElemAt: ['$_tagMatch.captures', 2] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 1] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 0] }
                    ]
                  },
                  format: '%Y-%m-%d'
                }
              },
              '$sentAt'
            ]
          }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$_dateFromTag' } },
          payloadSize: 1,
          readingCount: 1,
          elapsedTime: 1,
          fee: 1,
          confirmed: 1,
          status: 1,
          sentAt: 1,
          confirmedAt: 1
        }
      },
      {
        $group: {
          _id: '$day',
          uploads:       { $sum: 1 },
          totalBytes:    { $sum: '$payloadSize' },
          totalReadings: { $sum: '$readingCount' },
          avgReadings:   { $avg: '$readingCount' },
          durations:     { $push: '$elapsedTime' },
          totalCost:     { $sum: '$fee' },
          pendingCount: {
            $sum: {
              $cond: [
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
          },
          confirmDurations: {
            $push: {
              $cond: [
                { $and: [{ $ne: ['$confirmedAt', null] }, { $ne: ['$sentAt', null] }] },
                { $subtract: ['$confirmedAt', '$sentAt'] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          uploads: 1,
          totalDataKB: { $divide: ['$totalBytes', 1024] },
          totalReadings: 1,
          avgReadingsPerUpload: '$avgReadings',
          durations: 1,
          totalCost: 1,
          avgCostPerReading: {
            $cond: [
              { $gt: ['$totalReadings', 0] },
              { $divide: ['$totalCost', '$totalReadings'] },
              0
            ]
          },
          pendingCount: 1,
          confirmedCount: 1,
          _filtered: {
            $filter: { input: '$confirmDurations', as: 'd', cond: { $ne: ['$$d', null] } }
          }
        }
      },
      {
        $project: {
          date: 1,
          uploads: 1,
          totalDataKB: 1,
          totalReadings: 1,
          avgReadingsPerUpload: 1,
          durations: 1,
          totalCost: 1,
          avgCostPerReading: 1,
          pendingCount: 1,
          confirmedCount: 1,
          avgTimeToConfirmMs: {
            $cond: [
              { $gt: [{ $size: '$_filtered' }, 0] },
              { $avg: '$_filtered' },
              0
            ]
          },
          p95TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n: { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $arrayElemAt: [
                      '$$sorted',
                      {
                        $toInt: {
                          $floor: {
                            $multiply: [0.95, { $subtract: ['$$n', 1] }]
                          }
                        }
                      }
                    ]
                  },
                  0
                ]
              }
            }
          },
          p50TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n: { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $let: {
                      vars: {
                        lower: {
                          $toInt: {
                            $floor: { $divide: [{ $subtract: ['$$n', 1] }, 2] }
                          }
                        },
                        upper: {
                          $toInt: { $floor: { $divide: ['$$n', 2] } }
                        }
                      },
                      in: {
                        $avg: [
                          { $arrayElemAt: ['$$sorted', '$$lower'] },
                          { $arrayElemAt: ['$$sorted', '$$upper'] }
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json(daily);
  } catch (err) {
    logger.error('[Stats] Error computing Signum daily stats:', err);
    res.status(500).json({ error: 'Failed to fetch Signum daily statistics' });
  }
});

/**
 * @swagger
 * /stats/signum/uploads/daily:
 *   get:
 *     summary: Daily Signum upload statistics (grouped by tag date)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of daily aggregates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, example: "2025-08-06" }
 *                   uploads: { type: integer }
 *                   totalDataKB: { type: number }
 *                   totalReadings: { type: integer }
 *                   avgReadingsPerUpload: { type: number }
 *                   avgTimeToConfirmMs: { type: number }
 *                   p50TimeToConfirmMs: { type: number }
 *                   p95TimeToConfirmMs: { type: number }
 *                   durations:
 *                     type: array
 *                     items: { type: number }
 *                   totalCost: { type: number }
 *                   avgCostPerReading: { type: number }
 *                   pendingCount: { type: integer }
 *                   confirmedCount: { type: integer }
 *       500:
 *         description: Server error
 */
router.get('/signum/uploads/daily', authMiddleware, async (_req, res) => {
  try {
    const daily = await UploadedMessage.aggregate([
      { $match: { blockchain: 'SIGNUM' } },
      {
        $addFields: {
          _tagMatch: { $regexFind: { input: '$index', regex: /_(\d{2})(\d{2})(\d{4})$/ } }
        }
      },
      {
        $addFields: {
          _dateFromTag: {
            $cond: [
              {
                $and: [
                  { $ne: ['$_tagMatch', null] },
                  { $gt: [{ $size: { $ifNull: ['$_tagMatch.captures', []] } }, 0] }
                ]
              },
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      { $arrayElemAt: ['$_tagMatch.captures', 2] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 1] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 0] }
                    ]
                  },
                  format: '%Y-%m-%d'
                }
              },
              '$sentAt'
            ]
          }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$_dateFromTag' } },
          payloadSize: 1,
          readingCount: 1,
          elapsedTime: 1,
          fee: 1,
          confirmed: 1,
          status: 1,
          sentAt: 1,
          confirmedAt: 1
        }
      },
      {
        $group: {
          _id: '$day',
          uploads:       { $sum: 1 },
          totalBytes:    { $sum: '$payloadSize' },
          totalReadings: { $sum: '$readingCount' },
          avgReadings:   { $avg: '$readingCount' },
          durations:     { $push: '$elapsedTime' },
          totalCost:     { $sum: '$fee' },
          pendingCount: {
            $sum: {
              $cond: [
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
          },
          confirmDurations: {
            $push: {
              $cond: [
                { $and: [{ $ne: ['$confirmedAt', null] }, { $ne: ['$sentAt', null] }] },
                { $subtract: ['$confirmedAt', '$sentAt'] },
                null
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          uploads: 1,
          totalDataKB: { $divide: ['$totalBytes', 1024] },
          totalReadings: 1,
          avgReadingsPerUpload: '$avgReadings',
          durations: 1,
          totalCost: 1,
          avgCostPerReading: {
            $cond: [
              { $gt: ['$totalReadings', 0] },
              { $divide: ['$totalCost', '$totalReadings'] },
              0
            ]
          },
          pendingCount: 1,
          confirmedCount: 1,
          _filtered: {
            $filter: { input: '$confirmDurations', as: 'd', cond: { $ne: ['$$d', null] } }
          }
        }
      },
      {
        $project: {
          date: 1,
          uploads: 1,
          totalDataKB: 1,
          totalReadings: 1,
          avgReadingsPerUpload: 1,
          durations: 1,
          totalCost: 1,
          avgCostPerReading: 1,
          pendingCount: 1,
          confirmedCount: 1,
          avgTimeToConfirmMs: {
            $cond: [
              { $gt: [{ $size: '$_filtered' }, 0] },
              { $avg: '$_filtered' },
              0
            ]
          },
          p95TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n: { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $arrayElemAt: [
                      '$$sorted',
                      {
                        $toInt: {
                          $floor: {
                            $multiply: [0.95, { $subtract: ['$$n', 1] }]
                          }
                        }
                      }
                    ]
                  },
                  0
                ]
              }
            }
          },
          p50TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$_filtered', sortBy: 1 } },
                n: { $size: '$_filtered' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $let: {
                      vars: {
                        lower: {
                          $toInt: {
                            $floor: { $divide: [{ $subtract: ['$$n', 1] }, 2] }
                          }
                        },
                        upper: {
                          $toInt: { $floor: { $divide: ['$$n', 2] } }
                        }
                      },
                      in: {
                        $avg: [
                          { $arrayElemAt: ['$$sorted', '$$lower'] },
                          { $arrayElemAt: ['$$sorted', '$$upper'] }
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json(daily);
  } catch (err) {
    logger.error('[Stats] Error computing Signum daily stats:', err);
    res.status(500).json({ error: 'Failed to fetch Signum daily statistics' });
  }
});

/**
 * @swagger
 * /stats/iota/uploads/daily:
 *   get:
 *     summary: Daily IOTA upload statistics (grouped by tag date)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of daily aggregates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date: { type: string, example: "2025-08-06" }
 *                   uploads: { type: integer }
 *                   totalDataKB: { type: number }
 *                   totalReadings: { type: integer }
 *                   avgReadingsPerUpload: { type: number }
 *                   avgTimeToConfirmMs: { type: number }
 *                   p50TimeToConfirmMs: { type: number }
 *                   p95TimeToConfirmMs: { type: number }
 *                   durations:
 *                     type: array
 *                     items: { type: number }
 *                   totalCost: { type: number, description: "Always 0 for IOTA" }
 *                   avgCostPerReading: { type: number, description: "Always 0 for IOTA" }
 *                   pendingCount: { type: integer, description: "Always 0 for IOTA" }
 *                   confirmedCount: { type: integer }
 *       500:
 *         description: Server error
 */
router.get('/iota/uploads/daily', authMiddleware, async (_req, res) => {
  try {
    const daily = await UploadedMessage.aggregate([
      { $match: { blockchain: 'IOTA' } },
      {
        $addFields: {
          _tagMatch: { $regexFind: { input: '$index', regex: /_(\d{2})(\d{2})(\d{4})$/ } }
        }
      },
      {
        $addFields: {
          _dateFromTag: {
            $cond: [
              {
                $and: [
                  { $ne: ['$_tagMatch', null] },
                  { $gt: [{ $size: { $ifNull: ['$_tagMatch.captures', []] } }, 0] }
                ]
              },
              {
                $dateFromString: {
                  dateString: {
                    $concat: [
                      { $arrayElemAt: ['$_tagMatch.captures', 2] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 1] }, '-',
                      { $arrayElemAt: ['$_tagMatch.captures', 0] }
                    ]
                  },
                  format: '%Y-%m-%d'
                }
              },
              '$sentAt'
            ]
          }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$_dateFromTag' } },
          payloadSize: 1,
          readingCount: 1,
          elapsedTime: 1
        }
      },
      {
        $group: {
          _id: '$day',
          uploads:       { $sum: 1 },
          totalBytes:    { $sum: '$payloadSize' },
          totalReadings: { $sum: '$readingCount' },
          avgReadings:   { $avg: '$readingCount' },
          durations:     { $push: '$elapsedTime' },
          avgElapsed:    { $avg: '$elapsedTime' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          uploads: 1,
          totalDataKB: { $divide: ['$totalBytes', 1024] },
          totalReadings: 1,
          avgReadingsPerUpload: '$avgReadings',
          avgTimeToConfirmMs: '$avgElapsed',
          p95TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$durations', sortBy: 1 } },
                n: { $size: '$durations' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $arrayElemAt: [
                      '$$sorted',
                      {
                        $toInt: {
                          $floor: { $multiply: [0.95, { $subtract: ['$$n', 1] }] }
                        }
                      }
                    ]
                  },
                  0
                ]
              }
            }
          },
          p50TimeToConfirmMs: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$durations', sortBy: 1 } },
                n: { $size: '$durations' }
              },
              in: {
                $cond: [
                  { $gt: ['$$n', 0] },
                  {
                    $let: {
                      vars: {
                        lower: {
                          $toInt: {
                            $floor: { $divide: [{ $subtract: ['$$n', 1] }, 2] }
                          }
                        },
                        upper: {
                          $toInt: { $floor: { $divide: ['$$n', 2] } }
                        }
                      },
                      in: {
                        $avg: [
                          { $arrayElemAt: ['$$sorted', '$$lower'] },
                          { $arrayElemAt: ['$$sorted', '$$upper'] }
                        ]
                      }
                    }
                  },
                  0
                ]
              }
            }
          },
          durations: 1,
          totalCost: { $literal: 0 },
          avgCostPerReading: { $literal: 0 },
          pendingCount: { $literal: 0 },
          confirmedCount: '$uploads'
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json(daily);
  } catch (err) {
    logger.error('[Stats] Error computing IOTA daily stats:', err);
    res.status(500).json({ error: 'Failed to fetch IOTA daily statistics' });
  }
});


/**
 * @swagger
 * /stats/iota/explorer-links:
 *   get:
 *     summary: List explorer links for IOTA uploads
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: confirmed
 *         schema: { type: boolean }
 *         description: Filter by confirmation status
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [25, 50, 100]
 *           default: 50
 *         description: Page size
 *     responses:
 *       200:
 *         description: Paginated IOTA explorer links
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:   { type: integer }
 *                 totalPages:   { type: integer }
 *                 currentPage:  { type: integer }
 *                 limit:        { type: integer }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:        { type: string }
 *                       payloadSize:  { type: integer }
 *                       readingCount: { type: integer }
 *                       confirmed:    { type: boolean }
 *                       explorerUrl:  { type: string }
 *                       txId:         { type: string }
 *                       sentAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/iota/explorer-links', authMiddleware, async (req, res) => {
  try {
    const { confirmed, page = '1', limit = '50' } = req.query;

    // pagination guards
    const allowed = new Set([25, 50, 100]);
    const limitNum = allowed.has(Number(limit)) ? Number(limit) : 50;
    const pageNum  = Math.max(parseInt(page, 10) || 1, 1);

    // filter
    const q = { blockchain: 'IOTA' };
    if (typeof confirmed !== 'undefined') {
      q.confirmed = confirmed === 'true';
    }

    const totalItems = await UploadedMessage.countDocuments(q);

    const items = await UploadedMessage.find(q)
      .sort({ sentAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('txId explorerUrl index sentAt confirmed readingCount payloadSize')
      .lean();

    res.json({
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limitNum)),
      currentPage: pageNum,
      limit: limitNum,
      items,
    });
  } catch (err) {
    logger.error('[Stats] /stats/iota/explorer-links error:', err);
    res.status(500).json({ error: 'Failed to fetch IOTA explorer links' });
  }
});


/**
 * @swagger
 * /stats/signum/explorer-links:
 *   get:
 *     summary: List explorer links for Signum uploads
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: confirmed
 *         schema: { type: boolean }
 *         description: Filter by confirmation status
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [25, 50, 100]
 *           default: 50
 *         description: Page size
 *     responses:
 *       200:
 *         description: Paginated Signum explorer links
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:   { type: integer }
 *                 totalPages:   { type: integer }
 *                 currentPage:  { type: integer }
 *                 limit:        { type: integer }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:        { type: string }
 *                       payloadSize:  { type: integer }
 *                       readingCount: { type: integer }
 *                       confirmed:    { type: boolean }
 *                       explorerUrl:  { type: string }
 *                       txId:         { type: string }
 *                       sentAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/signum/explorer-links', authMiddleware, async (req, res) => {
  try {
    const { confirmed, page = '1', limit = '50' } = req.query;

    // pagination guards
    const allowed = new Set([25, 50, 100]);
    const limitNum = allowed.has(Number(limit)) ? Number(limit) : 50;
    const pageNum  = Math.max(parseInt(page, 10) || 1, 1);

    // filter
    const q = { blockchain: 'SIGNUM' };
    if (typeof confirmed !== 'undefined') {
      q.confirmed = confirmed === 'true';
    }

    const totalItems = await UploadedMessage.countDocuments(q);

    const items = await UploadedMessage.find(q)
      .sort({ sentAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('txId explorerUrl index sentAt confirmed readingCount payloadSize')
      .lean();

    res.json({
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limitNum)),
      currentPage: pageNum,
      limit: limitNum,
      items,
    });
  } catch (err) {
    logger.error('[Stats] /stats/signum/explorer-links error:', err);
    res.status(500).json({ error: 'Failed to fetch Signum explorer links' });
  }
});


module.exports = router;
