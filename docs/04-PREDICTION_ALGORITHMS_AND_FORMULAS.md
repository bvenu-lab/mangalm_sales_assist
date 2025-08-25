# Prediction Algorithms & Formulas
## Mangalm Sales Assistant - ML/AI Implementation

### Overview
This document details the mathematical models, algorithms, and formulas used in the Mangalm Sales Assistant's predictive intelligence system. Our approach combines traditional statistical methods with modern machine learning techniques to achieve industry-leading accuracy.

---

## Order Prediction Algorithms

### 1. Time-Series Forecasting Model

#### SARIMA (Seasonal ARIMA) Implementation
```python
# Model: SARIMA(p,d,q)(P,D,Q)s
# where p,d,q are non-seasonal parameters
# P,D,Q are seasonal parameters, s is seasonal period

SARIMA(2,1,2)(1,1,1)12

# Mathematical Formula:
(1 - φ₁L - φ₂L²)(1 - Φ₁L¹²)∇∇₁₂ yₜ = 
(1 + θ₁L + θ₂L²)(1 + Θ₁L¹²)εₜ

where:
- L is the lag operator
- ∇ is the difference operator
- φᵢ are autoregressive parameters
- θᵢ are moving average parameters
- Φ, Θ are seasonal parameters
- εₜ is white noise
```

#### Prophet Model Enhancement
```python
# Facebook Prophet with custom seasonality
y(t) = g(t) + s(t) + h(t) + εₜ

where:
g(t) = Growth trend (linear or logistic)
s(t) = Seasonal components
h(t) = Holiday effects
εₜ = Error term

# Growth function:
g(t) = (k + a(t)ᵀδ)t + (m + a(t)ᵀγ)

# Seasonality (Fourier series):
s(t) = Σₙ₌₁ᴺ (aₙcos(2πnt/P) + bₙsin(2πnt/P))

# Holiday effect:
h(t) = Σᵢ κᵢ · 1{t ∈ Dᵢ}
```

### 2. Machine Learning Ensemble Model

#### XGBoost Regression
```python
# Objective Function:
L(θ) = Σᵢ l(yᵢ, ŷᵢ⁽ᵗ⁻¹⁾ + fₜ(xᵢ)) + Ω(fₜ)

where:
- l is the loss function
- Ω is the regularization term
- fₜ is the new tree at iteration t

# Regularization:
Ω(f) = γT + ½λΣⱼ₌₁ᵀ wⱼ²

where:
- T is number of leaves
- w is leaf weights
- γ, λ are regularization parameters

# Feature Engineering:
features = [
    'days_since_last_order',
    'average_order_interval',
    'order_quantity_trend',
    'seasonal_index',
    'day_of_week',
    'month_of_year',
    'promotional_period',
    'competitor_activity',
    'weather_index',
    'economic_indicator'
]
```

#### Random Forest Enhancement
```python
# Ensemble prediction:
ŷ = 1/B Σᵦ₌₁ᴮ Tᵦ(x)

where:
- B is number of trees
- Tᵦ is individual tree prediction

# Variable importance:
VIⱼ = 1/B Σᵦ₌₁ᴮ Σₜ∈Tᵦ I(v(t) = j) · p(t) · Δₜ

where:
- v(t) is variable used at node t
- p(t) is proportion of samples at node t
- Δₜ is impurity decrease at node t
```

### 3. Deep Learning Models

#### LSTM Network Architecture
```python
# LSTM Cell Equations:
fₜ = σ(Wf · [hₜ₋₁, xₜ] + bf)    # Forget gate
iₜ = σ(Wi · [hₜ₋₁, xₜ] + bi)    # Input gate
C̃ₜ = tanh(WC · [hₜ₋₁, xₜ] + bC) # Candidate values
Cₜ = fₜ * Cₜ₋₁ + iₜ * C̃ₜ        # Cell state
oₜ = σ(Wo · [hₜ₋₁, xₜ] + bo)    # Output gate
hₜ = oₜ * tanh(Cₜ)              # Hidden state

# Network Architecture:
Input Layer: (batch_size, sequence_length, features)
LSTM Layer 1: 128 units, return_sequences=True
Dropout: 0.2
LSTM Layer 2: 64 units
Dropout: 0.2
Dense Layer: 32 units, ReLU activation
Output Layer: 1 unit (predicted days to order)
```

#### Transformer Model
```python
# Self-Attention Mechanism:
Attention(Q, K, V) = softmax(QKᵀ/√dₖ)V

where:
- Q = Query matrix (WQ · X)
- K = Key matrix (WK · X)
- V = Value matrix (WV · X)
- dₖ = dimension of key vectors

# Multi-Head Attention:
MultiHead(Q, K, V) = Concat(head₁, ..., headₕ)WO
where headᵢ = Attention(QWQᵢ, KWKᵢ, VWVᵢ)

# Position Encoding:
PE(pos, 2i) = sin(pos/10000^(2i/dmodel))
PE(pos, 2i+1) = cos(pos/10000^(2i/dmodel))
```

---

## Call Prioritization Algorithm

### Composite Scoring Model

#### Priority Score Calculation
```python
# Main Formula:
Priority_Score = Σᵢ (wᵢ × normalized_factorᵢ) × urgency_multiplier

# Detailed Calculation:
PS = w₁×RF + w₂×OV + w₃×GP + w₄×CL + w₅×GE + w₆×RS

where:
- RF = Reorder Frequency Score
- OV = Order Value Score
- GP = Growth Potential Score
- CL = Customer Loyalty Score
- GE = Geographic Efficiency Score
- RS = Relationship Strength Score

# Weight Distribution:
w₁ = 0.25 (Reorder Frequency)
w₂ = 0.20 (Order Value)
w₃ = 0.20 (Growth Potential)
w₄ = 0.15 (Customer Loyalty)
w₅ = 0.10 (Geographic Efficiency)
w₆ = 0.10 (Relationship Strength)
```

#### Individual Factor Calculations

##### Reorder Frequency Score
```python
RF = (1 - e^(-λt)) × 100

where:
- λ = average order rate (orders/day)
- t = days since last order

# Normalization:
RF_normalized = (RF - RF_min)/(RF_max - RF_min)
```

##### Order Value Score
```python
OV = log₁₀(AOV/AOV_median) × 50 + 50

where:
- AOV = Average Order Value for store
- AOV_median = Median AOV across all stores

# Trend adjustment:
OV_adjusted = OV × (1 + trend_coefficient)
trend_coefficient = (AOV_recent - AOV_historical)/AOV_historical
```

##### Growth Potential Score
```python
GP = α × Market_Share_Gap + β × Category_Penetration + γ × Wallet_Share

where:
- α = 0.4
- β = 0.3
- γ = 0.3

# Market Share Gap:
MSG = (Market_Size - Current_Sales)/Market_Size × 100

# Category Penetration:
CP = (Categories_Purchased/Total_Categories) × 100

# Wallet Share:
WS = (Our_Sales/Total_Procurement) × 100
```

##### Geographic Efficiency Score
```python
# Traveling Salesman Problem approximation
GE = 100 × (1 - normalized_distance)

# Distance calculation (Haversine formula):
d = 2r × arcsin(√(sin²((lat₂-lat₁)/2) + cos(lat₁)×cos(lat₂)×sin²((lon₂-lon₁)/2)))

# Cluster bonus:
if store in optimal_cluster:
    GE = GE × 1.2
```

---

## Product Upselling Algorithms

### 1. Collaborative Filtering

#### Matrix Factorization (SVD)
```python
# Rating matrix decomposition:
R ≈ P × Qᵀ

where:
- R = Store-Product rating matrix (m×n)
- P = Store feature matrix (m×k)
- Q = Product feature matrix (n×k)
- k = number of latent factors

# Optimization:
min Σ(rᵤᵢ - pᵤqᵢᵀ)² + λ(||pᵤ||² + ||qᵢ||²)

# Gradient descent update:
pᵤ ← pᵤ + α(eᵤᵢqᵢ - λpᵤ)
qᵢ ← qᵢ + α(eᵤᵢpᵤ - λqᵢ)

where eᵤᵢ = rᵤᵢ - pᵤqᵢᵀ
```

#### Item-Item Similarity
```python
# Cosine similarity:
sim(i,j) = (Rᵢ · Rⱼ)/(||Rᵢ|| × ||Rⱼ||)

# Adjusted cosine similarity:
sim(i,j) = Σᵤ((rᵤᵢ - r̄ᵤ)(rᵤⱼ - r̄ᵤ))/√(Σᵤ(rᵤᵢ - r̄ᵤ)² × Σᵤ(rᵤⱼ - r̄ᵤ)²)

# Prediction:
r̂ᵤᵢ = (Σⱼ∈N(i) sim(i,j) × rᵤⱼ)/(Σⱼ∈N(i) |sim(i,j)|)
```

### 2. Association Rules Mining

#### Apriori Algorithm
```python
# Support:
support(X) = |{t ∈ T : X ⊆ t}|/|T|

# Confidence:
confidence(X → Y) = support(X ∪ Y)/support(X)

# Lift:
lift(X → Y) = support(X ∪ Y)/(support(X) × support(Y))

# Conviction:
conviction(X → Y) = (1 - support(Y))/(1 - confidence(X → Y))

# Rule generation:
if support(X ∪ Y) ≥ min_support 
   and confidence(X → Y) ≥ min_confidence
   and lift(X → Y) > 1:
   then recommend Y when X is purchased
```

#### FP-Growth Enhancement
```python
# FP-Tree construction:
1. Scan database for frequent 1-itemsets
2. Sort items by frequency
3. Build FP-tree with header table
4. Mine patterns recursively

# Pattern growth:
for each item i in header_table:
    pattern_base = get_conditional_pattern_base(i)
    conditional_tree = build_conditional_FP_tree(pattern_base)
    if conditional_tree is not empty:
        mine_patterns(conditional_tree, i)
```

### 3. Deep Learning Recommendations

#### Neural Collaborative Filtering
```python
# Architecture:
Input: [user_id, item_id]
↓
Embedding Layers:
- User Embedding: (n_users, embedding_dim)
- Item Embedding: (n_items, embedding_dim)
↓
GMF Layer: element-wise product
MLP Layers: concatenation → Dense(64) → Dense(32) → Dense(16)
↓
NeuMF Layer: concatenate(GMF, MLP)
↓
Output: sigmoid(Dense(1))

# Loss function:
L = -Σᵤ,ᵢ yᵤᵢlog(ŷᵤᵢ) + (1-yᵤᵢ)log(1-ŷᵤᵢ) + λ||Θ||²
```

#### Attention-based Model
```python
# User attention over items:
αᵤᵢ = exp(score(hᵤ, hᵢ))/Σⱼexp(score(hᵤ, hⱼ))

# Context vector:
cᵤ = Σᵢ αᵤᵢhᵢ

# Score function:
score(hᵤ, hᵢ) = vᵀtanh(Wᵤhᵤ + Wᵢhᵢ + b)

# Final prediction:
ŷᵤᵢ = σ(wᵀ[hᵤ; hᵢ; cᵤ] + b)
```

---

## Demand Forecasting

### Hierarchical Forecasting

#### Bottom-up Approach
```python
# Store-SKU level forecast:
ŷₛₖᵤ,ₜ = f(Xₛₖᵤ,ₜ)

# Aggregation:
ŷcategory,t = Σₛₖᵤ∈category ŷₛₖᵤ,ₜ
ŷstore,t = Σₛₖᵤ∈store ŷₛₖᵤ,ₜ
ŷtotal,t = ΣΣ ŷₛₖᵤ,ₜ
```

#### Top-down Approach
```python
# Total forecast:
ŷtotal,t = g(Xtotal,t)

# Proportion calculation:
pₛₖᵤ = historical_salesₛₖᵤ/total_historical_sales

# Disaggregation:
ŷₛₖᵤ,ₜ = pₛₖᵤ × ŷtotal,t
```

#### Optimal Reconciliation
```python
# MinT (Minimum Trace) reconciliation:
ỹ = SGŷ

where:
- S = Summing matrix
- G = (S'W⁻¹S)⁻¹S'W⁻¹
- W = Covariance matrix of base forecasts
```

### Causal Impact Analysis

#### Bayesian Structural Time Series
```python
# State space model:
yₜ = Zₜαₜ + εₜ,  εₜ ~ N(0, σ²)
αₜ₊₁ = Tₜαₜ + Rₜηₜ,  ηₜ ~ N(0, Qₜ)

# Components:
- Local level: μₜ = μₜ₋₁ + ηₜ
- Local trend: δₜ = δₜ₋₁ + ηₜ
- Seasonal: sₜ = -Σᵢ₌₁ˢ⁻¹ sₜ₋ᵢ + ηₜ
- Regression: βXₜ

# Causal impact:
impact = yₜ^observed - yₜ^predicted
```

---

## Performance Metrics

### Prediction Accuracy Metrics

#### Regression Metrics
```python
# Mean Absolute Error (MAE):
MAE = (1/n)Σᵢ₌₁ⁿ |yᵢ - ŷᵢ|

# Root Mean Square Error (RMSE):
RMSE = √((1/n)Σᵢ₌₁ⁿ (yᵢ - ŷᵢ)²)

# Mean Absolute Percentage Error (MAPE):
MAPE = (100/n)Σᵢ₌₁ⁿ |yᵢ - ŷᵢ|/|yᵢ|

# Symmetric MAPE (sMAPE):
sMAPE = (100/n)Σᵢ₌₁ⁿ 2|yᵢ - ŷᵢ|/(|yᵢ| + |ŷᵢ|)

# R-squared:
R² = 1 - (Σ(yᵢ - ŷᵢ)²/Σ(yᵢ - ȳ)²)
```

#### Classification Metrics (for binary predictions)
```python
# Precision:
Precision = TP/(TP + FP)

# Recall:
Recall = TP/(TP + FN)

# F1 Score:
F1 = 2 × (Precision × Recall)/(Precision + Recall)

# ROC-AUC:
AUC = ∫₀¹ TPR(FPR⁻¹(x))dx
```

### Business Impact Metrics

#### Revenue Impact
```python
# Revenue Lift:
Revenue_Lift = (Revenue_with_predictions - Revenue_baseline)/Revenue_baseline × 100

# Stock-out Prevention Value:
SOV = Σ(prevented_stockouts × average_lost_sale_value)

# Upselling Success:
Upsell_Revenue = Σ(accepted_recommendations × recommendation_value)
```

#### Efficiency Metrics
```python
# Call Efficiency:
CE = successful_visits/total_visits × 100

# Route Optimization Savings:
ROS = (distance_baseline - distance_optimized)/distance_baseline × fuel_cost

# Time Savings:
TS = (time_manual - time_automated)/time_manual × hourly_cost
```

---

## Model Training & Optimization

### Hyperparameter Tuning

#### Grid Search
```python
param_grid = {
    'n_estimators': [100, 200, 300],
    'max_depth': [5, 10, 15, None],
    'min_samples_split': [2, 5, 10],
    'min_samples_leaf': [1, 2, 4],
    'learning_rate': [0.01, 0.1, 0.3]
}

best_params = GridSearchCV(
    estimator=model,
    param_grid=param_grid,
    cv=5,
    scoring='neg_mean_squared_error'
)
```

#### Bayesian Optimization
```python
# Gaussian Process surrogate:
f(x) ~ GP(μ(x), k(x, x'))

# Acquisition function (Expected Improvement):
EI(x) = E[max(f(x) - f(x⁺), 0)]
     = (μ(x) - f(x⁺))Φ(Z) + σ(x)φ(Z)

where Z = (μ(x) - f(x⁺))/σ(x)
```

### Cross-Validation Strategy

#### Time Series Cross-Validation
```python
# Walk-forward validation:
for i in range(n_splits):
    train = data[0:train_size + i*step]
    test = data[train_size + i*step:train_size + (i+1)*step]
    model.fit(train)
    predictions = model.predict(test)
    scores.append(evaluate(test, predictions))
```

---

## Real-Time Adaptation

### Online Learning
```python
# Stochastic Gradient Descent update:
θₜ₊₁ = θₜ - ηₜ∇L(θₜ, xₜ, yₜ)

# Learning rate schedule:
ηₜ = η₀/(1 + decay_rate × t)

# Adaptive learning (Adam):
mₜ = β₁mₜ₋₁ + (1-β₁)gₜ
vₜ = β₂vₜ₋₁ + (1-β₂)gₜ²
m̂ₜ = mₜ/(1-β₁ᵗ)
v̂ₜ = vₜ/(1-β₂ᵗ)
θₜ₊₁ = θₜ - η × m̂ₜ/(√v̂ₜ + ε)
```

### Concept Drift Detection
```python
# Page-Hinkley Test:
mₜ = mₜ₋₁ + (xₜ - x̄ - δ)
PHₜ = max(0, PHₜ₋₁ + xₜ - x̄ - δ)

if PHₜ - mₜ > λ:
    trigger_model_retraining()

# ADWIN (Adaptive Windowing):
if |μ₀ - μ₁| > εcut:
    detect_change()
    drop_old_window()
```

---

## Implementation Best Practices

### Feature Engineering Pipeline
```python
# Temporal Features:
- Hour of day
- Day of week
- Day of month
- Week of year
- Month
- Quarter
- Is_weekend
- Is_holiday
- Days_to_holiday

# Lag Features:
- Sales_lag_1, Sales_lag_7, Sales_lag_30
- Rolling_mean_7, Rolling_mean_30
- Rolling_std_7, Rolling_std_30
- Exponential_weighted_mean

# Interaction Features:
- Product × Store
- Category × Season
- Price × Promotion
- Weather × Category

# Encoding:
- Target encoding for high cardinality
- One-hot encoding for low cardinality
- Ordinal encoding for ordered categories
```

### Model Ensemble Strategy
```python
# Weighted Average:
ŷ_ensemble = Σᵢ wᵢ × ŷᵢ

# Stacking:
Level 0: [Model1, Model2, Model3] → [ŷ₁, ŷ₂, ŷ₃]
Level 1: Meta_model([ŷ₁, ŷ₂, ŷ₃]) → ŷ_final

# Blending:
Train: 80% → Train base models
Validation: 20% → Generate predictions
Meta-model: Train on validation predictions
```

This comprehensive documentation of algorithms and formulas provides the mathematical foundation for the Mangalm Sales Assistant's predictive capabilities, ensuring transparency, reproducibility, and continuous improvement of the system.