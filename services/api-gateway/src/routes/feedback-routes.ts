import { Router, Request, Response } from 'express';
import { Resend } from 'resend';
import { logger } from '../utils/logger';
import { db } from '../database/db-connection';

const router = Router();

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_development');

// Email configuration from environment
const FROM_EMAIL = process.env.FROM_EMAIL || 'feedback@mangalm.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mangalm.com';

/**
 * Submit feedback and send email notification
 */
router.post('/feedback/submit', async (req: Request, res: Response) => {
  try {
    const {
      type = 'general',
      message,
      userEmail,
      userName,
      timestamp,
      source = 'unknown',
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Feedback message is required'
      });
    }

    // Store feedback in database
    const feedbackId = await storeFeedback({
      type,
      message,
      userEmail,
      userName,
      timestamp,
      source,
      metadata
    });

    // Prepare email content
    const emailSubject = `[${type.toUpperCase()}] Feedback from ${userName || 'User'}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f7f9fc;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 15px;
          }
          .badge.bug { background: #fee; color: #c00; }
          .badge.improvement { background: #e3f2fd; color: #1976d2; }
          .badge.suggestion { background: #fff3e0; color: #f57c00; }
          .badge.general { background: #f3e5f5; color: #7b1fa2; }
          .message-box {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin: 20px 0;
          }
          .metadata {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 14px;
            color: #666;
          }
          .metadata-item {
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .metadata-item:last-child {
            border-bottom: none;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
          }
          h1 { margin: 0; font-size: 24px; }
          h3 { color: #333; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📮 New Feedback Received</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">From Mangalm Sales Assistant Dashboard</p>
          </div>
          <div class="content">
            <span class="badge ${type}">${type}</span>

            <h3>Feedback Message:</h3>
            <div class="message-box">
              ${message.replace(/\n/g, '<br>')}
            </div>

            <div class="metadata">
              <h4 style="margin-top: 0;">Details:</h4>
              <div class="metadata-item">
                <strong>From:</strong> ${userName || 'Anonymous'} (${userEmail || 'No email provided'})
              </div>
              <div class="metadata-item">
                <strong>Timestamp:</strong> ${new Date(timestamp || Date.now()).toLocaleString()}
              </div>
              <div class="metadata-item">
                <strong>Source:</strong> ${source}
              </div>
              <div class="metadata-item">
                <strong>Page URL:</strong> ${metadata.url || 'Not provided'}
              </div>
              <div class="metadata-item">
                <strong>Feedback ID:</strong> #${feedbackId}
              </div>
            </div>
          </div>
          <div class="footer">
            <p>This feedback was submitted through the AI Feedback Assistant.</p>
            <p>Powered by Mangalm Sales Assistant</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend
    try {
      const emailResult = await resend.emails.send({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: emailSubject,
        html: emailHtml,
        replyTo: userEmail || undefined,
        tags: [
          { name: 'type', value: type },
          { name: 'source', value: 'feedback-assistant' }
        ]
      });

      logger.info('Feedback email sent successfully', {
        feedbackId,
        emailId: emailResult.data?.id,
        type,
        userName
      });

    } catch (emailError: any) {
      logger.error('Failed to send feedback email', {
        error: emailError.message,
        feedbackId,
        type
      });
      // Don't fail the request if email fails - feedback is still saved
    }

    // Send success response
    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId,
      data: {
        id: feedbackId,
        type,
        timestamp: timestamp || new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error submitting feedback', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to submit feedback. Please try again later.'
    });
  }
});

/**
 * Get feedback statistics
 */
router.get('/feedback/stats', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bug_reports,
        COUNT(CASE WHEN type = 'improvement' THEN 1 END) as improvements,
        COUNT(CASE WHEN type = 'suggestion' THEN 1 END) as suggestions,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
      FROM feedback
    `;

    const result = await db.query(query);

    res.json({
      success: true,
      data: result.rows[0] || {
        total_feedback: 0,
        bug_reports: 0,
        improvements: 0,
        suggestions: 0,
        last_7_days: 0,
        last_30_days: 0
      }
    });
  } catch (error: any) {
    logger.error('Error fetching feedback stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback statistics'
    });
  }
});

/**
 * Store feedback in the database
 */
async function storeFeedback(feedback: any): Promise<string> {
  try {
    // First, ensure the feedback table exists
    await ensureFeedbackTable();

    const query = `
      INSERT INTO feedback (
        type,
        message,
        user_email,
        user_name,
        source,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      feedback.type,
      feedback.message,
      feedback.userEmail,
      feedback.userName,
      feedback.source,
      JSON.stringify(feedback.metadata),
      feedback.timestamp || new Date()
    ];

    const result = await db.query(query, values);
    return result.rows[0].id;

  } catch (error: any) {
    logger.error('Error storing feedback in database', error);
    // Return a fallback ID if database storage fails
    return `TEMP-${Date.now()}`;
  }
}

/**
 * Ensure feedback table exists
 */
async function ensureFeedbackTable(): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      user_email VARCHAR(255),
      user_name VARCHAR(255),
      source VARCHAR(100),
      metadata JSONB,
      status VARCHAR(50) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
    CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
  `;

  try {
    await db.query(createTableQuery);
    logger.info('Feedback table ensured');
  } catch (error: any) {
    logger.error('Error creating feedback table', error);
  }
}

export { router as feedbackRoutes };