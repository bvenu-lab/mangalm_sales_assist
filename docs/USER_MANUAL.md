# Mangalm Sales Assistant - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Store Management](#store-management)
4. [Order Predictions](#order-predictions)
5. [Order Management](#order-management)
6. [Agent Management](#agent-management)
7. [Reports & Analytics](#reports--analytics)
8. [System Administration](#system-administration)
9. [Mobile Application](#mobile-application)
10. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements
- **Browser**: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- **Screen Resolution**: 1024x768 minimum, 1920x1080 recommended
- **Internet**: Broadband connection recommended

### First Time Login

1. **Access the System**
   - Open your web browser
   - Navigate to: `http://localhost:3000` (or your configured URL)
   - You should see the Mangalm login screen

2. **Login Credentials**
   ```
   Default Admin Account:
   Username: admin
   Password: admin123
   ```

3. **Initial Setup**
   - Change your password immediately after first login
   - Update your profile information
   - Configure your notification preferences

### Navigation Overview

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Mangalm Sales Assistant            [User] [⚙️] │
├─────────────────────────────────────────────────────────┤
│ 📊 Dashboard  🏪 Stores  📦 Orders  🤖 Predictions     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  Main Content Area                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Dashboard Overview

### Main Dashboard

The dashboard provides a real-time overview of your sales operations:

#### Key Metrics Cards
- **Total Stores**: Number of active stores in your network
- **Pending Orders**: Orders awaiting confirmation
- **Today's Revenue**: Revenue generated today
- **Active Agents**: Number of agents currently working

#### Interactive Charts
1. **Sales Trend Chart**: Shows revenue trends over time
2. **Store Performance**: Top-performing stores by revenue
3. **Prediction Accuracy**: ML model performance metrics
4. **Agent Performance**: Individual agent statistics

#### Quick Actions
- **Generate Prediction**: Start a new prediction for selected stores
- **Create Order**: Quickly create a new order
- **View Reports**: Access detailed analytics reports

### Real-time Updates

The dashboard updates automatically every 30 seconds. Look for:
- 🔴 **Red indicators**: Critical issues requiring attention
- 🟡 **Yellow indicators**: Warnings or pending actions
- 🟢 **Green indicators**: Normal operations

## Store Management

### Viewing Stores

1. **Navigate to Stores**
   - Click on "🏪 Stores" in the main navigation
   - You'll see a list of all registered stores

2. **Store List Features**
   - **Search**: Type in the search box to find specific stores
   - **Filter**: Use filters for city, state, size, or status
   - **Sort**: Click column headers to sort data

### Store Information

Each store card/row displays:
- **Store Name**: Primary identifier
- **Location**: City and state
- **Contact**: Phone number and email
- **Manager**: Current store manager
- **Revenue**: Total revenue to date
- **Last Order**: Date of most recent order
- **Status**: Active/Inactive indicator

### Adding a New Store

1. **Click "Add Store" Button**
2. **Fill Required Information**:
   ```
   Basic Information:
   - Store Name: [Required]
   - Store Code: [Auto-generated or manual]
   - Category: Premium/Standard/Basic
   
   Contact Details:
   - Address: [Required]
   - City: [Required]
   - State: [Required]
   - PIN Code: [Required]
   - Phone: [Required]
   - Email: [Optional but recommended]
   
   Management:
   - Manager Name: [Required]
   - Manager Phone: [Optional]
   ```

3. **Save Store**
   - Click "Save" to create the store
   - You'll receive a confirmation message

### Editing Store Information

1. **Select Store**: Click on a store name or use the edit icon
2. **Modify Information**: Update any editable fields
3. **Save Changes**: Click "Update Store"

⚠️ **Note**: Some fields like Store Code cannot be changed after creation.

## Order Predictions

### Understanding Predictions

The AI prediction system analyzes:
- **Historical Sales Data**: Past order patterns
- **Seasonal Trends**: Time-based buying patterns
- **Store Performance**: Individual store characteristics
- **Market Conditions**: External factors affecting demand

### Generating Predictions

1. **Start New Prediction**
   - Go to "🤖 Predictions" section
   - Click "Generate New Prediction"

2. **Configure Prediction**:
   ```
   Prediction Settings:
   - Time Horizon: 7, 15, 30, or 90 days
   - Store Selection: All stores or specific stores
   - Product Categories: All or specific categories
   - Model Type: Standard, Advanced, or Ensemble
   ```

3. **Review Settings**
   - Double-check your selections
   - Click "Generate Prediction"

4. **Wait for Processing**
   - Predictions typically take 2-5 minutes
   - You'll see a progress indicator
   - You can continue using the system while waiting

### Understanding Prediction Results

#### Prediction Summary
- **Total Predicted Revenue**: Expected revenue for the period
- **Number of Products**: Products included in prediction
- **Confidence Score**: Model's confidence (0-100%)
- **Processing Time**: Time taken to generate prediction

#### Detailed Results
Each predicted item shows:
- **Product Name**: What product is predicted
- **Store**: Which store the prediction is for
- **Quantity**: Predicted quantity needed
- **Confidence**: Confidence level for this specific prediction
- **Revenue**: Expected revenue from this item

#### Confidence Levels
- 🟢 **High (80-100%)**: Very reliable predictions
- 🟡 **Medium (60-79%)**: Good predictions with some uncertainty
- 🔴 **Low (0-59%)**: Use with caution, consider manual review

### Using Predictions

1. **Review Predictions**
   - Check confidence levels
   - Compare with your business knowledge
   - Identify any obvious errors

2. **Create Orders from Predictions**
   - Select items you want to order
   - Click "Create Order from Selected"
   - System will pre-fill order form

3. **Adjust Quantities**
   - Modify quantities based on your judgment
   - Consider current inventory levels
   - Factor in special circumstances

## Order Management

### Viewing Orders

1. **Order List**
   - Navigate to "📦 Orders"
   - See all orders with their status

2. **Order Filters**
   - **Status**: Pending, Confirmed, Shipped, Delivered, Cancelled
   - **Date Range**: Custom date selection
   - **Store**: Filter by specific stores
   - **Agent**: Filter by assigned agent

### Order Statuses

| Status | Description | Actions Available |
|--------|-------------|------------------|
| **Draft** | Being created, not submitted | Edit, Delete, Submit |
| **Pending** | Submitted, awaiting confirmation | Confirm, Cancel, Edit |
| **Confirmed** | Approved and processing | Ship, Cancel |
| **Shipped** | In transit to store | Mark Delivered |
| **Delivered** | Successfully delivered | Mark Complete |
| **Cancelled** | Cancelled before delivery | View Only |

### Creating Orders

#### Manual Order Creation

1. **Start New Order**
   - Click "Create Order" button
   - Select the store from dropdown

2. **Add Products**:
   ```
   For each product:
   - Product Name: [Search and select]
   - Quantity: [Enter quantity]
   - Unit Price: [Auto-filled, editable]
   - Discount: [Optional percentage]
   ```

3. **Order Details**:
   ```
   Delivery Information:
   - Delivery Date: [Required]
   - Special Instructions: [Optional]
   
   Payment Terms:
   - Payment Method: NET15/NET30/COD
   - Credit Terms: [If applicable]
   ```

4. **Review and Submit**
   - Check order total
   - Verify all details
   - Click "Submit Order"

#### Order from Prediction

1. **Go to Predictions Section**
2. **Select Recent Prediction**
3. **Choose Products**
   - Select items you want to order
   - Modify quantities if needed
4. **Follow Normal Order Process**

### Managing Existing Orders

#### Editing Orders
- Only draft and pending orders can be edited
- Click order number to open details
- Make necessary changes
- Save or resubmit

#### Order Actions
- **Confirm Order**: Approve for processing
- **Ship Order**: Mark as shipped with tracking info
- **Cancel Order**: Cancel with reason
- **View Details**: See complete order information

### Order Communications

#### Automated Notifications
The system automatically sends:
- Order confirmation to store
- Shipping notifications
- Delivery confirmations

#### Manual Communication
- Add notes to orders for internal reference
- Send custom messages to stores
- Track communication history

## Agent Management

### Agent Dashboard

Sales agents can:
- View assigned stores
- Check pending orders
- Generate predictions for their stores
- Update order statuses
- Track their performance metrics

### Agent Performance Metrics

#### Individual Metrics
- **Orders Processed**: Number of orders handled
- **Revenue Generated**: Total revenue from orders
- **Prediction Accuracy**: How accurate their predictions are
- **Customer Satisfaction**: Store feedback scores

#### Comparative Metrics
- Ranking against other agents
- Department averages
- Performance trends

### Managing Agent Assignments

1. **Store Assignments**
   - Go to Agent Management (Admin only)
   - Select agent
   - Assign/remove stores

2. **Performance Monitoring**
   - Review weekly/monthly reports
   - Identify training needs
   - Set performance goals

## Reports & Analytics

### Standard Reports

#### Sales Reports
1. **Revenue Analysis**
   - Daily, weekly, monthly revenue
   - Year-over-year comparisons
   - Revenue by store/region/product

2. **Order Analysis**
   - Order volume trends
   - Average order value
   - Order fulfillment metrics

3. **Store Performance**
   - Top/bottom performing stores
   - Store growth rates
   - Market penetration analysis

#### Prediction Reports
1. **Accuracy Reports**
   - Model performance over time
   - Accuracy by store/product
   - Confidence score analysis

2. **Usage Reports**
   - Prediction generation frequency
   - Most predicted products
   - Agent prediction usage

### Custom Reports

1. **Report Builder**
   - Select data sources
   - Choose metrics and dimensions
   - Apply filters and date ranges
   - Format output (table, chart, export)

2. **Scheduled Reports**
   - Set up automated report generation
   - Email delivery to stakeholders
   - Custom frequencies (daily, weekly, monthly)

### Data Export

#### Export Options
- **Excel**: For detailed analysis
- **PDF**: For presentations
- **CSV**: For external systems
- **API**: For integration purposes

#### Bulk Data Export
- Select date ranges
- Choose specific data sets
- Schedule regular exports

## System Administration

### User Management

#### Adding New Users

1. **Navigate to Admin Panel** (Admin only)
2. **Click "Add User"**
3. **Fill User Information**:
   ```
   Basic Info:
   - Username: [Unique identifier]
   - Full Name: [Display name]
   - Email: [For notifications]
   - Phone: [Optional]
   
   Access Control:
   - Role: Admin, Manager, Agent, Viewer
   - Permissions: Specific feature access
   - Store Access: Which stores user can see
   ```

4. **Set Initial Password**
   - System generates secure password
   - User must change on first login

#### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management |
| **Manager** | Store management, reports, agent oversight |
| **Agent** | Store access, order management, predictions |
| **Viewer** | Read-only access to assigned stores |

### System Configuration

#### General Settings
- Company information
- System timezone
- Default currency
- Date/time formats

#### Integration Settings
- Zoho CRM configuration
- Email server setup
- SMS gateway configuration
- Payment gateway settings

#### Security Settings
- Password policies
- Session timeout
- Two-factor authentication
- IP restrictions

### Backup and Maintenance

#### Data Backup
- Automatic daily backups
- Manual backup creation
- Backup verification
- Restore procedures

#### System Maintenance
- Regular system updates
- Database optimization
- Log file management
- Performance monitoring

## Mobile Application

### Getting the Mobile App

The Mangalm mobile app is available for:
- iOS (iPhone/iPad)
- Android phones and tablets

Download from respective app stores or use the responsive web version.

### Mobile Features

#### Core Functionality
- Dashboard overview
- Store information
- Order creation and management
- Basic predictions
- Push notifications

#### Mobile-Specific Features
- Offline mode for basic operations
- GPS-based store check-ins
- Camera integration for documentation
- Push notifications for urgent items

### Mobile Limitations

Some features are desktop-only:
- Advanced report generation
- System administration
- Bulk data operations
- Complex prediction configurations

## Troubleshooting

### Common Issues

#### Login Problems

**Problem**: Cannot log in
**Solutions**:
1. Verify username and password
2. Check if Caps Lock is on
3. Try password reset
4. Contact administrator if account is locked

**Problem**: Page won't load
**Solutions**:
1. Check internet connection
2. Try refreshing the page
3. Clear browser cache
4. Try different browser

#### Performance Issues

**Problem**: System is slow
**Solutions**:
1. Check internet speed
2. Close unnecessary browser tabs
3. Try during off-peak hours
4. Contact support if persistent

**Problem**: Reports not generating
**Solutions**:
1. Check selected date range
2. Verify permissions
3. Try smaller data sets
4. Contact support for large reports

#### Data Issues

**Problem**: Missing stores/orders
**Solutions**:
1. Check date filters
2. Verify user permissions
3. Check data sync status
4. Contact administrator

**Problem**: Incorrect predictions
**Solutions**:
1. Check input data quality
2. Verify time horizons
3. Consider external factors
4. Provide feedback for model improvement

### Getting Help

#### In-App Help
- Click the "?" icon for contextual help
- Check tooltips on form fields
- Use the search function in help sections

#### Support Channels
1. **Help Desk**: Available during business hours
2. **Email Support**: support@mangalm.com
3. **Phone Support**: +91-XXX-XXX-XXXX
4. **Online Documentation**: docs.mangalm.com

#### Emergency Support
For critical system issues:
- Use emergency contact number
- Send high-priority support ticket
- Contact your system administrator

### Best Practices

#### Data Quality
- Keep store information updated
- Ensure accurate order entry
- Regularly verify contact information
- Remove inactive stores

#### Security
- Change passwords regularly
- Log out when finished
- Don't share login credentials
- Report suspicious activity

#### Performance
- Close unused browser tabs
- Use recommended browsers
- Keep system updated
- Report performance issues

---

*User Manual Version: 1.0.0*  
*Last Updated: 2025-08-10*  
*For Technical Support: support@mangalm.com*