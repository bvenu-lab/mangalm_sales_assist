const axios = require('axios');

async function testFeedbackAssistant() {
  console.log('🤖 Testing Feedback Assistant Integration\n');
  console.log('=' .repeat(50));

  const feedbackData = {
    type: 'suggestion',
    message: 'Test feedback from automated testing script. The new dashboard looks great! I would love to see more data visualization options and maybe a dark mode theme.',
    userEmail: 'test@mangalm.com',
    userName: 'Test User',
    timestamp: new Date().toISOString(),
    source: 'test-script',
    metadata: {
      url: 'http://localhost:3000/dashboard',
      userAgent: 'Test Script v1.0'
    }
  };

  try {
    console.log('\n📤 Sending feedback to API...');
    console.log('   Type:', feedbackData.type);
    console.log('   From:', feedbackData.userName);
    console.log('   Message:', feedbackData.message.substring(0, 50) + '...');

    const response = await axios.post(
      'http://localhost:3007/api/feedback/submit',
      feedbackData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log('\n✅ FEEDBACK SUBMITTED SUCCESSFULLY!');
      console.log('   Feedback ID:', response.data.feedbackId);
      console.log('   Status:', response.data.message);

      console.log('\n📧 Email Details:');
      console.log('   From:', process.env.FROM_EMAIL || 'SoloForge.AI <eran@soloforgeai.com>');
      console.log('   To:', process.env.ADMIN_EMAIL || 'eran@soloforgeai.com');
      console.log('   Subject: [SUGGESTION] Feedback from Test User');

      console.log('\n🎯 FEATURES IMPLEMENTED:');
      console.log('   ✅ Floating AI Assistant button in lower left');
      console.log('   ✅ Modern UI with gradient design');
      console.log('   ✅ Welcome message with instructions');
      console.log('   ✅ Feedback type selection (Bug/Improvement/Suggestion)');
      console.log('   ✅ Text area with character counter');
      console.log('   ✅ Email sent via Resender API');
      console.log('   ✅ Feedback stored in database');
      console.log('   ✅ Success/error notifications');

      console.log('\n📱 TO TEST IN BROWSER:');
      console.log('   1. Open http://localhost:3000/dashboard');
      console.log('   2. Look for the floating button in lower left corner');
      console.log('   3. Click to open the Feedback Assistant');
      console.log('   4. Select feedback type (Bug/Improvement/Suggestion)');
      console.log('   5. Enter your feedback message');
      console.log('   6. Click "Send Feedback"');
      console.log('   7. Check email at:', process.env.ADMIN_EMAIL || 'eran@soloforgeai.com');

      // Test fetching stats
      console.log('\n📊 Fetching feedback statistics...');
      const statsResponse = await axios.get('http://localhost:3007/api/feedback/stats');

      if (statsResponse.data.success) {
        const stats = statsResponse.data.data;
        console.log('   Total Feedback:', stats.total_feedback);
        console.log('   Bug Reports:', stats.bug_reports);
        console.log('   Improvements:', stats.improvements);
        console.log('   Suggestions:', stats.suggestions);
        console.log('   Last 7 days:', stats.last_7_days);
      }

    } else {
      console.log('❌ Failed to submit feedback:', response.data.error);
    }

  } catch (error) {
    console.error('\n❌ Error testing feedback assistant:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.data?.error || error.response.data);
    } else {
      console.error('   Error:', error.message);
      console.error('\n⚠️  Make sure the API Gateway is running on port 3007');
      console.error('   Run: cd services/api-gateway && PORT=3007 npm start');
    }
  }

  console.log('\n' + '=' .repeat(50));
}

// Set environment variables if not already set
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_iDuD6crZ_EQrpvghaSj2aqNxCxY46hE5h';
process.env.FROM_EMAIL = process.env.FROM_EMAIL || 'SoloForge.AI <eran@soloforgeai.com>';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'eran@soloforgeai.com';

testFeedbackAssistant();