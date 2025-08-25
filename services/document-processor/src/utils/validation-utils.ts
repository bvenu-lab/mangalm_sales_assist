/**
 * Validation Utilities - Phase 6
 * Enterprise-Grade Validation for Mangalm Sales Assistant Order Management
 * 
 * Comprehensive validation utilities for order data, business rules,
 * and data quality assessment with detailed error reporting.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { OrderItem, OrderFormData, ValidationError, QualityAssessment, Suggestion } from '../models/order.entity';

export interface BusinessRuleValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number;
}

export interface DataQualityResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: QualityDimension[];
}

export interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  issues: string[];
  suggestions: string[];
}

export class ValidationUtils {
  
  /**
   * Validate order data against comprehensive business rules
   */
  static validateBusinessRules(order: Partial<OrderFormData>): BusinessRuleValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    // Financial validation
    this.validateFinancialRules(order, errors, warnings);
    
    // Customer data validation
    this.validateCustomerData(order, errors, warnings);
    
    // Order items validation
    this.validateOrderItems(order, errors, warnings);
    
    // Delivery validation
    this.validateDeliveryRules(order, errors, warnings);
    
    // Calculate compliance score
    const errorWeight = errors.length * 20;
    const warningWeight = warnings.length * 10;
    const score = Math.max(0, 100 - errorWeight - warningWeight);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score
    };
  }
  
  /**
   * Assess overall data quality with detailed analysis
   */
  static assessDataQuality(order: Partial<OrderFormData>, validationResult: BusinessRuleValidationResult): DataQualityResult {
    const dimensions: QualityDimension[] = [
      this.assessCompleteness(order),
      this.assessAccuracy(order),
      this.assessConsistency(order),
      this.assessBusinessCompliance(validationResult),
      this.assessExtrationQuality(order)
    ];
    
    // Calculate weighted overall score
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const weightedScore = dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0);
    const overallScore = Math.round(weightedScore / totalWeight);
    
    // Determine grade
    const grade = this.calculateGrade(overallScore);
    
    return {
      overallScore,
      grade,
      dimensions
    };
  }
  
  /**
   * Generate improvement suggestions based on quality assessment
   */
  static generateSuggestions(order: Partial<OrderFormData>, qualityResult: DataQualityResult): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Analyze each quality dimension for suggestions
    qualityResult.dimensions.forEach(dimension => {
      dimension.suggestions.forEach(suggestion => {
        suggestions.push({
          type: 'enhancement',
          field: this.mapDimensionToField(dimension.name),
          message: suggestion
        });
      });
    });
    
    // Add specific data corrections
    this.addDataCorrectionSuggestions(order, suggestions);
    
    // Add business optimization suggestions
    this.addBusinessOptimizationSuggestions(order, suggestions);
    
    return suggestions;
  }
  
  // Private validation methods
  
  private static validateFinancialRules(order: Partial<OrderFormData>, errors: ValidationError[], warnings: ValidationError[]) {
    // Minimum order amount validation
    if (order.totalAmount !== undefined && order.totalAmount < 500) {
      errors.push({
        field: 'totalAmount',
        message: `Order total ₹${order.totalAmount} is below minimum ₹500 requirement`,
        severity: 'error',
        confidence: 1.0
      });
    }
    
    // GST calculation validation (18%)
    if (order.subtotalAmount !== undefined && order.taxAmount !== undefined) {
      const expectedTax = Math.round(order.subtotalAmount * 0.18 * 100) / 100;
      if (Math.abs(order.taxAmount - expectedTax) > 0.01) {
        warnings.push({
          field: 'taxAmount',
          message: `Tax amount ₹${order.taxAmount} should be ₹${expectedTax} (18% GST)`,
          severity: 'warning',
          confidence: 0.9
        });
      }
    }
    
    // Total calculation validation
    if (order.subtotalAmount && order.taxAmount && order.totalAmount) {
      const expectedTotal = order.subtotalAmount + order.taxAmount - (order.discountAmount || 0) + (order.shippingAmount || 0);
      if (Math.abs(order.totalAmount - expectedTotal) > 0.01) {
        errors.push({
          field: 'totalAmount',
          message: `Total amount calculation mismatch. Expected ₹${expectedTotal}, got ₹${order.totalAmount}`,
          severity: 'error',
          confidence: 1.0
        });
      }
    }
    
    // Pricing validation
    if (order.items) {
      order.items.forEach((item, index) => {
        if (item.unitPrice < 0) {
          errors.push({
            field: `items[${index}].unitPrice`,
            message: `Item ${index + 1}: Unit price cannot be negative`,
            severity: 'error'
          });
        }
        
        if (item.quantity <= 0) {
          errors.push({
            field: `items[${index}].quantity`,
            message: `Item ${index + 1}: Quantity must be greater than zero`,
            severity: 'error'
          });
        }
        
        const expectedTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
        if (Math.abs(item.totalPrice - expectedTotal) > 0.01) {
          warnings.push({
            field: `items[${index}].totalPrice`,
            message: `Item ${index + 1}: Total price calculation mismatch`,
            severity: 'warning'
          });
        }
      });
    }
  }
  
  private static validateCustomerData(order: Partial<OrderFormData>, errors: ValidationError[], warnings: ValidationError[]) {
    // Customer name validation
    if (!order.customerName || order.customerName.trim().length < 2) {
      errors.push({
        field: 'customerName',
        message: 'Customer name is required and must be at least 2 characters',
        severity: 'error'
      });
    }
    
    // Phone number validation (Indian format)
    if (order.customerPhone) {
      const cleanPhone = order.customerPhone.replace(/[\s\-\(\)]/g, '');
      if (!/^[\+]?[91]?[6-9]\d{9}$/.test(cleanPhone)) {
        warnings.push({
          field: 'customerPhone',
          message: 'Phone number should be in valid Indian format (+91-XXXXXXXXXX)',
          severity: 'warning'
        });
      }
    } else {
      warnings.push({
        field: 'customerPhone',
        message: 'Customer phone number is recommended for order delivery',
        severity: 'warning'
      });
    }
    
    // Email validation
    if (order.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(order.customerEmail)) {
        warnings.push({
          field: 'customerEmail',
          message: 'Invalid email format',
          severity: 'warning'
        });
      }
    }
  }
  
  private static validateOrderItems(order: Partial<OrderFormData>, errors: ValidationError[], warnings: ValidationError[]) {
    if (!order.items || order.items.length === 0) {
      errors.push({
        field: 'items',
        message: 'Order must contain at least one item',
        severity: 'error'
      });
      return;
    }
    
    // Validate individual items
    order.items.forEach((item, index) => {
      if (!item.productName || item.productName.trim().length === 0) {
        errors.push({
          field: `items[${index}].productName`,
          message: `Item ${index + 1}: Product name is required`,
          severity: 'error'
        });
      }
      
      // Check for reasonable quantities
      if (item.quantity > 100) {
        warnings.push({
          field: `items[${index}].quantity`,
          message: `Item ${index + 1}: Large quantity (${item.quantity}) - please verify`,
          severity: 'warning'
        });
      }
      
      // Check for extraction confidence
      if (item.extractionConfidence !== undefined && item.extractionConfidence < 0.7) {
        warnings.push({
          field: `items[${index}].productName`,
          message: `Item ${index + 1}: Low extraction confidence (${(item.extractionConfidence * 100).toFixed(0)}%) - manual review recommended`,
          severity: 'warning'
        });
      }
    });
  }
  
  private static validateDeliveryRules(order: Partial<OrderFormData>, errors: ValidationError[], warnings: ValidationError[]) {
    // Delivery date validation
    if (order.requestedDeliveryDate) {
      const deliveryDate = new Date(order.requestedDeliveryDate);
      const orderDate = order.orderDate ? new Date(order.orderDate) : new Date();
      const daysDiff = (deliveryDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 1) {
        warnings.push({
          field: 'requestedDeliveryDate',
          message: 'Same-day delivery may not be available for all locations',
          severity: 'warning'
        });
      }
      
      if (daysDiff > 30) {
        warnings.push({
          field: 'requestedDeliveryDate',
          message: 'Delivery date is more than 30 days away',
          severity: 'warning'
        });
      }
    }
  }
  
  private static assessCompleteness(order: Partial<OrderFormData>): QualityDimension {
    const requiredFields = ['customerName', 'items', 'totalAmount'];
    const importantFields = ['customerPhone', 'customerEmail', 'orderDate'];
    const optionalFields = ['notes', 'requestedDeliveryDate', 'specialInstructions'];
    
    let score = 0;
    let totalWeight = 0;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Required fields (60% weight)
    requiredFields.forEach(field => {
      totalWeight += 20;
      if (order[field as keyof OrderFormData]) {
        score += 20;
      } else {
        issues.push(`Missing required field: ${field}`);
        suggestions.push(`Add ${field} to complete the order`);
      }
    });
    
    // Important fields (30% weight)
    importantFields.forEach(field => {
      totalWeight += 10;
      if (order[field as keyof OrderFormData]) {
        score += 10;
      } else {
        suggestions.push(`Consider adding ${field} for better customer service`);
      }
    });
    
    // Optional fields (10% weight)
    optionalFields.forEach(field => {
      totalWeight += 3.33;
      if (order[field as keyof OrderFormData]) {
        score += 3.33;
      }
    });
    
    return {
      name: 'Data Completeness',
      score: Math.round(score),
      weight: 0.25,
      issues,
      suggestions
    };
  }
  
  private static assessAccuracy(order: Partial<OrderFormData>): QualityDimension {
    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check extraction confidence
    if (order.extractionConfidence !== undefined) {
      const confidenceScore = order.extractionConfidence * 100;
      if (confidenceScore < 80) {
        score -= (80 - confidenceScore) * 0.5;
        issues.push(`Low overall extraction confidence: ${confidenceScore.toFixed(0)}%`);
        suggestions.push('Manual verification recommended for critical fields');
      }
    }
    
    // Check item-level accuracy
    if (order.items) {
      const itemAccuracyIssues = order.items.filter(item => 
        item.extractionConfidence !== undefined && item.extractionConfidence < 0.8
      );
      
      if (itemAccuracyIssues.length > 0) {
        score -= itemAccuracyIssues.length * 10;
        issues.push(`${itemAccuracyIssues.length} items have low extraction confidence`);
        suggestions.push('Review and verify product names and quantities');
      }
    }
    
    return {
      name: 'Data Accuracy',
      score: Math.max(0, Math.round(score)),
      weight: 0.3,
      issues,
      suggestions
    };
  }
  
  private static assessConsistency(order: Partial<OrderFormData>): QualityDimension {
    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Check calculation consistency
    if (order.items && order.subtotalAmount) {
      const calculatedSubtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
      if (Math.abs(calculatedSubtotal - order.subtotalAmount) > 0.01) {
        score -= 20;
        issues.push('Subtotal calculation inconsistency');
        suggestions.push('Recalculate subtotal from item totals');
      }
    }
    
    // Check tax consistency
    if (order.subtotalAmount && order.taxAmount) {
      const expectedTax = order.subtotalAmount * 0.18;
      if (Math.abs(order.taxAmount - expectedTax) > 0.01) {
        score -= 15;
        issues.push('Tax calculation inconsistency');
        suggestions.push('Apply 18% GST rate consistently');
      }
    }
    
    return {
      name: 'Data Consistency',
      score: Math.max(0, Math.round(score)),
      weight: 0.2,
      issues,
      suggestions
    };
  }
  
  private static assessBusinessCompliance(validationResult: BusinessRuleValidationResult): QualityDimension {
    return {
      name: 'Business Compliance',
      score: validationResult.score,
      weight: 0.15,
      issues: validationResult.errors.map(e => e.message),
      suggestions: validationResult.warnings.map(w => `Address warning: ${w.message}`)
    };
  }
  
  private static assessExtrationQuality(order: Partial<OrderFormData>): QualityDimension {
    let score = 100;
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    if (order.manualVerificationRequired) {
      score -= 20;
      issues.push('Manual verification required');
      suggestions.push('Complete manual verification before processing');
    }
    
    if (!order.manuallyVerified && order.source === 'document') {
      score -= 10;
      suggestions.push('Manual verification recommended for document-extracted orders');
    }
    
    return {
      name: 'Extraction Quality',
      score: Math.max(0, Math.round(score)),
      weight: 0.1,
      issues,
      suggestions
    };
  }
  
  private static calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
  
  private static mapDimensionToField(dimensionName: string): string {
    const mapping: Record<string, string> = {
      'Data Completeness': 'general',
      'Data Accuracy': 'extractionConfidence',
      'Data Consistency': 'totals',
      'Business Compliance': 'businessRules',
      'Extraction Quality': 'manualVerification'
    };
    
    return mapping[dimensionName] || 'general';
  }
  
  private static addDataCorrectionSuggestions(order: Partial<OrderFormData>, suggestions: Suggestion[]) {
    // Phone number formatting
    if (order.customerPhone && !/^\+91/.test(order.customerPhone)) {
      suggestions.push({
        type: 'correction',
        field: 'customerPhone',
        message: 'Format phone number with country code (+91)',
        suggestedValue: `+91-${order.customerPhone.replace(/\D/g, '').slice(-10)}`
      });
    }
    
    // Customer name capitalization
    if (order.customerName && order.customerName !== order.customerName.toUpperCase()) {
      const properCase = order.customerName
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (properCase !== order.customerName) {
        suggestions.push({
          type: 'correction',
          field: 'customerName',
          message: 'Standardize name capitalization',
          suggestedValue: properCase
        });
      }
    }
  }
  
  private static addBusinessOptimizationSuggestions(order: Partial<OrderFormData>, suggestions: Suggestion[]) {
    // Minimum order optimization
    if (order.totalAmount && order.totalAmount < 500 && order.totalAmount > 400) {
      const needed = 500 - order.totalAmount;
      suggestions.push({
        type: 'enhancement',
        field: 'items',
        message: `Add ₹${needed.toFixed(2)} more to reach minimum order amount and avoid cancellation`
      });
    }
    
    // Delivery date optimization
    if (!order.requestedDeliveryDate) {
      const suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 3);
      
      suggestions.push({
        type: 'enhancement',
        field: 'requestedDeliveryDate',
        message: 'Add delivery date for better planning',
        suggestedValue: suggestedDate.toISOString().split('T')[0]
      });
    }
  }
}