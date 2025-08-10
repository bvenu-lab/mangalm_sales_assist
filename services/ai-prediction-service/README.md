# AI Prediction Service

The AI Prediction Service is a microservice component of the SoloForge Platform that provides intelligent prediction and recommendation capabilities for sales operations. This service leverages machine learning and AI to analyze historical data and generate actionable insights.

## Key Features

### 1. Store-Specific Order Prediction
- Analyzes historical order patterns to predict future orders
- Implements seasonal adjustment factors for improved accuracy
- Provides confidence scores for each prediction
- Continuously learns from feedback to improve accuracy

### 2. AI Upselling Recommendation
- Identifies product affinities based on historical purchases
- Generates personalized product recommendations for each store
- Considers inventory levels and promotions in recommendations
- Provides diverse recommendations with explanation capabilities

### 3. Call Prioritization Algorithm
- Scores stores based on sales opportunity and relationship factors
- Considers time since last order and geographic proximity
- Balances workload across sales agents
- Provides priority explanations for transparency

### 4. Performance Analytics
- Tracks sales agent performance metrics
- Monitors prediction accuracy and recommendation effectiveness
- Generates performance reports and visualizations
- Provides goal tracking and achievement metrics

## Technical Architecture

The service is built using:
- Node.js and TypeScript for type-safe development
- TensorFlow.js for machine learning capabilities
- OpenAI API for natural language processing
- Express.js for RESTful API endpoints
- Winston for comprehensive logging
- Jest for unit and integration testing

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Docker (for containerized deployment)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration

### Development

Start the development server:
```
npm run dev
```

Run tests:
```
npm test
```

Build for production:
```
npm run build
```

### Docker Deployment

Build the Docker image:
```
docker build -t ai-prediction-service .
```

Run the container:
```
docker run -p 3004:3004 --env-file .env ai-prediction-service
```

## API Documentation

### Order Prediction Endpoints

- `GET /api/predictions/orders/store/:storeId` - Get predicted orders for a specific store
- `POST /api/predictions/orders/batch` - Generate predictions for multiple stores
- `PUT /api/predictions/orders/:predictionId/feedback` - Provide feedback on prediction accuracy

### Recommendation Endpoints

- `GET /api/recommendations/upsell/store/:storeId` - Get upselling recommendations for a store
- `GET /api/recommendations/upsell/product/:productId` - Get complementary products for a specific product
- `POST /api/recommendations/upsell/feedback` - Provide feedback on recommendation effectiveness

### Call Prioritization Endpoints

- `GET /api/prioritization/calls` - Get prioritized call list for sales agents
- `GET /api/prioritization/calls/agent/:agentId` - Get agent-specific call priorities
- `POST /api/prioritization/calls/override` - Override automatic prioritization

### Performance Analytics Endpoints

- `GET /api/analytics/performance/agent/:agentId` - Get performance metrics for a specific agent
- `GET /api/analytics/performance/team` - Get team-wide performance metrics
- `GET /api/analytics/prediction/accuracy` - Get prediction accuracy metrics

## Integration with Other Services

The AI Prediction Service integrates with:
- **Database Orchestrator** - For accessing historical sales data
- **Zoho Integration Service** - For syncing with CRM data
- **Sales Frontend** - For displaying predictions and recommendations
- **API Gateway** - For unified API access and authentication

## License

Proprietary - All rights reserved
