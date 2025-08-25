import { configManager } from '../config';
import { monitoring } from './monitoring.service';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OCRResult, OCRWord, OCRLine } from './ocr-engine.service';

// Configure logger from enterprise configuration
const config = configManager.config;
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    config.logging.enableCorrelationId 
      ? winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
          return `${timestamp} [${level}] [${correlationId || 'no-correlation'}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      : winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.logging.enableFile ? [
      new winston.transports.File({
        filename: path.join(path.dirname(config.logging.file), 'text-postprocessor.log'),
        maxsize: config.logging.maxFileSize,
        maxFiles: config.logging.maxFiles
      })
    ] : [])
  ]
});

export interface TextCorrectionRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  confidence: number;
  category: 'OCR_ERROR' | 'FORMATTING' | 'LANGUAGE' | 'DOMAIN_SPECIFIC';
}

export interface SpellCheckResult {
  originalWord: string;
  suggestions: Array<{
    word: string;
    confidence: number;
    distance: number;
  }>;
  isCorrect: boolean;
  category: 'UNKNOWN' | 'MISSPELLED' | 'PROPER_NOUN' | 'TECHNICAL_TERM';
}

export interface TextQualityMetrics {
  readabilityScore: number;
  confidenceScore: number;
  errorRate: number;
  completenessScore: number;
  structureScore: number;
  languageScore: number;
  domainRelevanceScore: number;
}

export interface PostProcessingOptions {
  enableSpellCheck: boolean;
  enableGrammarCheck: boolean;
  enableStructureAnalysis: boolean;
  enableDomainCorrection: boolean;
  enableConfidenceFiltering: boolean;
  confidenceThreshold: number;
  languageModel: string;
  customDictionary?: string[];
  domainTerms?: string[];
  correlationId?: string;
}

export interface PostProcessingResult {
  originalText: string;
  correctedText: string;
  corrections: Array<{
    position: number;
    length: number;
    original: string;
    corrected: string;
    confidence: number;
    rule: string;
    category: string;
  }>;
  qualityMetrics: TextQualityMetrics;
  processingTime: number;
  metadata: {
    correlationId: string;
    timestamp: string;
    version: string;
    options: PostProcessingOptions;
    appliedRules: string[];
  };
}

class TextPostProcessorService {
  private static instance: TextPostProcessorService;
  private correctionRules: Map<string, TextCorrectionRule[]> = new Map();
  private commonWords: Set<string> = new Set();
  private domainTerms: Set<string> = new Set();
  private initialized: boolean = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): TextPostProcessorService {
    if (!TextPostProcessorService.instance) {
      TextPostProcessorService.instance = new TextPostProcessorService();
    }
    return TextPostProcessorService.instance;
  }

  private async initialize(): Promise<void> {
    const correlationId = this.generateCorrelationId();
    const startTime = Date.now();

    try {
      logger.info('Initializing Text Post-Processor Service', { correlationId });
      monitoring.incrementCounter('textprocessor.initialization.started', 1);

      // Load correction rules
      await this.loadCorrectionRules();

      // Load common words dictionary
      await this.loadCommonWordsDictionary();

      // Load domain-specific terms
      await this.loadDomainTerms();

      this.initialized = true;
      const initTime = Date.now() - startTime;

      logger.info('Text Post-Processor Service initialized successfully', {
        correlationId,
        initializationTime: initTime,
        rulesLoaded: this.correctionRules.size,
        commonWords: this.commonWords.size,
        domainTerms: this.domainTerms.size
      });

      monitoring.recordTiming('textprocessor.initialization.duration', initTime);
      monitoring.incrementCounter('textprocessor.initialization.completed', 1);

    } catch (error) {
      const initTime = Date.now() - startTime;
      logger.error('Failed to initialize Text Post-Processor Service', {
        error,
        correlationId,
        initializationTime: initTime
      });
      monitoring.recordTiming('textprocessor.initialization.failed_duration', initTime);
      monitoring.incrementCounter('textprocessor.initialization.failed', 1);
      throw error;
    }
  }

  private async loadCorrectionRules(): Promise<void> {
    try {
      // OCR-specific correction rules
      const ocrRules: TextCorrectionRule[] = [
        // Common OCR misrecognitions
        { pattern: /\b0(?=\w)/g, replacement: 'O', description: 'Zero to letter O', confidence: 0.8, category: 'OCR_ERROR' },
        { pattern: /(?<=\w)0\b/g, replacement: 'o', description: 'Zero to lowercase o', confidence: 0.8, category: 'OCR_ERROR' },
        { pattern: /\bl(?=\d)/g, replacement: '1', description: 'Lowercase l to digit 1', confidence: 0.9, category: 'OCR_ERROR' },
        { pattern: /(?<=\d)l\b/g, replacement: '1', description: 'Lowercase l to digit 1 at end', confidence: 0.9, category: 'OCR_ERROR' },
        { pattern: /\bS(?=\d)/g, replacement: '5', description: 'S to digit 5', confidence: 0.7, category: 'OCR_ERROR' },
        { pattern: /\bG(?=\d)/g, replacement: '6', description: 'G to digit 6', confidence: 0.7, category: 'OCR_ERROR' },
        { pattern: /\bB(?=\d)/g, replacement: '8', description: 'B to digit 8', confidence: 0.6, category: 'OCR_ERROR' },
        { pattern: /\brn/g, replacement: 'm', description: 'rn to m', confidence: 0.8, category: 'OCR_ERROR' },
        { pattern: /\bvv/g, replacement: 'w', description: 'vv to w', confidence: 0.8, category: 'OCR_ERROR' },
        { pattern: /\bcl/g, replacement: 'd', description: 'cl to d', confidence: 0.7, category: 'OCR_ERROR' },
        { pattern: /\bn'/g, replacement: 'n', description: 'n apostrophe to n', confidence: 0.8, category: 'OCR_ERROR' },
        
        // Common business document patterns
        { pattern: /\bQty\b/gi, replacement: 'Qty', description: 'Quantity standardization', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /\bEa\b/gi, replacement: 'Each', description: 'Each standardization', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /\bTotal\s*:/gi, replacement: 'Total:', description: 'Total label formatting', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /\bSubtotal\s*:/gi, replacement: 'Subtotal:', description: 'Subtotal label formatting', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /\bTax\s*:/gi, replacement: 'Tax:', description: 'Tax label formatting', confidence: 0.9, category: 'FORMATTING' },
        
        // Currency formatting
        { pattern: /\$\s*(\d)/g, replacement: '$$$1', description: 'Currency symbol spacing', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /(\d)\s*\$/g, replacement: '$1', description: 'Remove space before currency', confidence: 0.8, category: 'FORMATTING' },
        
        // Date formatting
        { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, replacement: '$1/$2/$3', description: 'Date format normalization', confidence: 0.9, category: 'FORMATTING' },
        { pattern: /(\d{1,2})-(\d{1,2})-(\d{2,4})/g, replacement: '$1/$2/$3', description: 'Date format standardization', confidence: 0.9, category: 'FORMATTING' },
        
        // Phone number formatting
        { pattern: /(\d{3})\s*[-.]?\s*(\d{3})\s*[-.]?\s*(\d{4})/g, replacement: '($1) $2-$3', description: 'Phone number formatting', confidence: 0.8, category: 'FORMATTING' },
        
        // Address formatting
        { pattern: /\bSt\b/gi, replacement: 'Street', description: 'Street abbreviation expansion', confidence: 0.7, category: 'FORMATTING' },
        { pattern: /\bAve\b/gi, replacement: 'Avenue', description: 'Avenue abbreviation expansion', confidence: 0.7, category: 'FORMATTING' },
        { pattern: /\bRd\b/gi, replacement: 'Road', description: 'Road abbreviation expansion', confidence: 0.7, category: 'FORMATTING' },
        { pattern: /\bBlvd\b/gi, replacement: 'Boulevard', description: 'Boulevard abbreviation expansion', confidence: 0.7, category: 'FORMATTING' },
      ];

      this.correctionRules.set('OCR_ERRORS', ocrRules.filter(r => r.category === 'OCR_ERROR'));
      this.correctionRules.set('FORMATTING', ocrRules.filter(r => r.category === 'FORMATTING'));
      this.correctionRules.set('LANGUAGE', ocrRules.filter(r => r.category === 'LANGUAGE'));
      this.correctionRules.set('DOMAIN_SPECIFIC', ocrRules.filter(r => r.category === 'DOMAIN_SPECIFIC'));

      logger.debug('Loaded correction rules', {
        totalRules: ocrRules.length,
        categories: Array.from(this.correctionRules.keys())
      });

    } catch (error) {
      logger.error('Failed to load correction rules', { error });
      throw error;
    }
  }

  private async loadCommonWordsDictionary(): Promise<void> {
    try {
      // Load common English words for spell checking
      const commonWords = [
        // Articles, pronouns, prepositions
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
        'this', 'that', 'these', 'those', 'here', 'there', 'where', 'when', 'why', 'how', 'what', 'who', 'which', 'whose',
        
        // Common business terms
        'order', 'invoice', 'receipt', 'payment', 'total', 'subtotal', 'tax', 'discount', 'price', 'cost', 'amount', 'quantity', 'qty', 'each', 'item', 'product',
        'customer', 'client', 'vendor', 'supplier', 'company', 'business', 'store', 'shop', 'address', 'phone', 'email', 'date', 'time',
        'name', 'first', 'last', 'middle', 'number', 'account', 'reference', 'description', 'details', 'notes', 'comments',
        
        // Numbers as words
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
        'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
        
        // Common adjectives and verbs
        'new', 'old', 'good', 'bad', 'big', 'small', 'large', 'little', 'long', 'short', 'high', 'low', 'right', 'left', 'next', 'last', 'first', 'second',
        'get', 'go', 'come', 'see', 'look', 'use', 'make', 'take', 'give', 'put', 'say', 'tell', 'know', 'think', 'feel', 'find', 'work', 'call', 'try'
      ];

      for (const word of commonWords) {
        this.commonWords.add(word.toLowerCase());
      }

      logger.debug('Loaded common words dictionary', { wordCount: this.commonWords.size });

    } catch (error) {
      logger.error('Failed to load common words dictionary', { error });
      throw error;
    }
  }

  private async loadDomainTerms(): Promise<void> {
    try {
      // Load domain-specific terms for business documents
      const businessTerms = [
        // Financial terms
        'invoice', 'receipt', 'payment', 'billing', 'remittance', 'statement', 'balance', 'credit', 'debit', 'refund', 'adjustment',
        'subtotal', 'tax', 'vat', 'gst', 'hst', 'pst', 'discount', 'surcharge', 'fee', 'shipping', 'handling', 'freight',
        
        // Product terms
        'sku', 'upc', 'barcode', 'model', 'serial', 'lot', 'batch', 'expiry', 'warranty', 'brand', 'manufacturer',
        'quantity', 'weight', 'volume', 'dimensions', 'color', 'size', 'grade', 'quality',
        
        // Business terms
        'purchase', 'order', 'quote', 'estimate', 'proposal', 'contract', 'agreement', 'terms', 'conditions',
        'vendor', 'supplier', 'distributor', 'wholesaler', 'retailer', 'customer', 'client', 'buyer', 'seller',
        'delivery', 'pickup', 'shipment', 'tracking', 'logistics', 'warehouse', 'inventory', 'stock',
        
        // Contact terms
        'address', 'street', 'avenue', 'road', 'boulevard', 'suite', 'apartment', 'unit', 'floor', 'building',
        'city', 'state', 'province', 'country', 'postal', 'zip', 'code', 'phone', 'fax', 'email', 'website',
        
        // Units of measure
        'piece', 'each', 'dozen', 'pair', 'set', 'box', 'case', 'pallet', 'pound', 'kilogram', 'gram', 'ounce',
        'liter', 'gallon', 'quart', 'pint', 'cup', 'meter', 'foot', 'inch', 'yard', 'centimeter', 'millimeter'
      ];

      for (const term of businessTerms) {
        this.domainTerms.add(term.toLowerCase());
      }

      logger.debug('Loaded domain terms', { termCount: this.domainTerms.size });

    } catch (error) {
      logger.error('Failed to load domain terms', { error });
      throw error;
    }
  }

  public async postProcessText(
    ocrResult: OCRResult, 
    options: Partial<PostProcessingOptions> = {}
  ): Promise<PostProcessingResult> {
    
    const correlationId = options.correlationId || this.generateCorrelationId();
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    const defaultOptions: PostProcessingOptions = {
      enableSpellCheck: true,
      enableGrammarCheck: true,
      enableStructureAnalysis: true,
      enableDomainCorrection: true,
      enableConfidenceFiltering: true,
      confidenceThreshold: config.processing.confidenceThreshold,
      languageModel: 'en',
      correlationId
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      logger.info('Starting text post-processing', {
        correlationId,
        originalTextLength: ocrResult.text.length,
        confidence: ocrResult.confidence,
        options: finalOptions
      });

      monitoring.incrementCounter('textprocessor.processing.started', 1);

      let processedText = ocrResult.text;
      const corrections: any[] = [];
      const appliedRules: string[] = [];

      // Step 1: Apply OCR error corrections
      if (finalOptions.enableSpellCheck) {
        const ocrCorrections = await this.applyOCRCorrections(processedText, correlationId);
        processedText = ocrCorrections.correctedText;
        corrections.push(...ocrCorrections.corrections);
        appliedRules.push('OCR_ERROR_CORRECTION');
      }

      // Step 2: Apply formatting corrections
      const formattingCorrections = await this.applyFormattingCorrections(processedText, correlationId);
      processedText = formattingCorrections.correctedText;
      corrections.push(...formattingCorrections.corrections);
      appliedRules.push('FORMATTING_CORRECTION');

      // Step 3: Apply domain-specific corrections
      if (finalOptions.enableDomainCorrection) {
        const domainCorrections = await this.applyDomainCorrections(processedText, correlationId);
        processedText = domainCorrections.correctedText;
        corrections.push(...domainCorrections.corrections);
        appliedRules.push('DOMAIN_CORRECTION');
      }

      // Step 4: Perform spell checking
      if (finalOptions.enableSpellCheck) {
        const spellCorrections = await this.performSpellCheck(processedText, correlationId);
        processedText = spellCorrections.correctedText;
        corrections.push(...spellCorrections.corrections);
        appliedRules.push('SPELL_CHECK');
      }

      // Step 5: Analyze structure and quality
      const qualityMetrics = await this.analyzeTextQuality(
        ocrResult.text, 
        processedText, 
        ocrResult, 
        correlationId
      );

      // Step 6: Apply confidence filtering if enabled
      if (finalOptions.enableConfidenceFiltering) {
        const filteredResult = await this.applyConfidenceFiltering(
          processedText, 
          ocrResult, 
          finalOptions.confidenceThreshold,
          correlationId
        );
        processedText = filteredResult.text;
        if (filteredResult.corrections.length > 0) {
          corrections.push(...filteredResult.corrections);
          appliedRules.push('CONFIDENCE_FILTERING');
        }
      }

      const processingTime = Date.now() - startTime;

      const result: PostProcessingResult = {
        originalText: ocrResult.text,
        correctedText: processedText,
        corrections,
        qualityMetrics,
        processingTime,
        metadata: {
          correlationId,
          timestamp: new Date().toISOString(),
          version: '2.1',
          options: finalOptions,
          appliedRules
        }
      };

      logger.info('Text post-processing completed', {
        correlationId,
        originalLength: ocrResult.text.length,
        correctedLength: processedText.length,
        correctionsApplied: corrections.length,
        qualityImprovement: qualityMetrics.confidenceScore - ocrResult.confidence,
        processingTime
      });

      monitoring.recordTiming('textprocessor.processing.duration', processingTime);
      monitoring.incrementCounter('textprocessor.processing.completed', 1);
      monitoring.recordMetric('textprocessor.corrections_applied', corrections.length);
      monitoring.recordMetric('textprocessor.quality_score', qualityMetrics.confidenceScore);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Text post-processing failed', {
        correlationId,
        error,
        processingTime
      });

      monitoring.recordTiming('textprocessor.processing.failed_duration', processingTime);
      monitoring.incrementCounter('textprocessor.processing.failed', 1);
      
      throw error;
    }
  }

  private async applyOCRCorrections(
    text: string, 
    correlationId: string
  ): Promise<{ correctedText: string; corrections: any[] }> {
    
    const corrections: any[] = [];
    let correctedText = text;
    const ocrRules = this.correctionRules.get('OCR_ERRORS') || [];

    for (const rule of ocrRules) {
      const matches = Array.from(correctedText.matchAll(rule.pattern));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          corrections.push({
            position: match.index,
            length: match[0].length,
            original: match[0],
            corrected: rule.replacement,
            confidence: rule.confidence,
            rule: rule.description,
            category: rule.category
          });
        }
      }

      correctedText = correctedText.replace(rule.pattern, rule.replacement);
    }

    logger.debug('Applied OCR corrections', {
      correlationId,
      correctionsApplied: corrections.length,
      rulesProcessed: ocrRules.length
    });

    return { correctedText, corrections };
  }

  private async applyFormattingCorrections(
    text: string, 
    correlationId: string
  ): Promise<{ correctedText: string; corrections: any[] }> {
    
    const corrections: any[] = [];
    let correctedText = text;
    const formattingRules = this.correctionRules.get('FORMATTING') || [];

    for (const rule of formattingRules) {
      const matches = Array.from(correctedText.matchAll(rule.pattern));
      
      for (const match of matches) {
        if (match.index !== undefined) {
          corrections.push({
            position: match.index,
            length: match[0].length,
            original: match[0],
            corrected: rule.replacement,
            confidence: rule.confidence,
            rule: rule.description,
            category: rule.category
          });
        }
      }

      correctedText = correctedText.replace(rule.pattern, rule.replacement);
    }

    // Additional formatting cleanup
    correctedText = this.cleanupWhitespace(correctedText);
    correctedText = this.standardizePunctuation(correctedText);

    logger.debug('Applied formatting corrections', {
      correlationId,
      correctionsApplied: corrections.length,
      rulesProcessed: formattingRules.length
    });

    return { correctedText, corrections };
  }

  private async applyDomainCorrections(
    text: string, 
    correlationId: string
  ): Promise<{ correctedText: string; corrections: any[] }> {
    
    const corrections: any[] = [];
    let correctedText = text;

    // Apply domain-specific term corrections
    const words = correctedText.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase().replace(/[^\w]/g, '');
      
      // Check if word is close to a domain term
      const bestMatch = this.findBestDomainMatch(word);
      
      if (bestMatch && bestMatch.distance <= 2 && bestMatch.confidence > 0.7) {
        corrections.push({
          position: text.indexOf(words[i]),
          length: words[i].length,
          original: words[i],
          corrected: bestMatch.term,
          confidence: bestMatch.confidence,
          rule: 'Domain term correction',
          category: 'DOMAIN_SPECIFIC'
        });
        
        words[i] = words[i].replace(word, bestMatch.term);
      }
    }

    correctedText = words.join(' ');

    logger.debug('Applied domain corrections', {
      correlationId,
      correctionsApplied: corrections.length,
      wordsProcessed: words.length
    });

    return { correctedText, corrections };
  }

  private async performSpellCheck(
    text: string, 
    correlationId: string
  ): Promise<{ correctedText: string; corrections: any[] }> {
    
    const corrections: any[] = [];
    let correctedText = text;

    // Simple spell checking against common words
    const words = correctedText.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const cleanWord = words[i].toLowerCase().replace(/[^\w]/g, '');
      
      if (cleanWord.length < 2) continue; // Skip very short words
      
      // Check if word exists in common words or domain terms
      if (!this.commonWords.has(cleanWord) && !this.domainTerms.has(cleanWord)) {
        // Find best spelling suggestion
        const suggestion = this.findBestSpellingSuggestion(cleanWord);
        
        if (suggestion && suggestion.confidence > 0.8) {
          corrections.push({
            position: text.indexOf(words[i]),
            length: words[i].length,
            original: words[i],
            corrected: suggestion.word,
            confidence: suggestion.confidence,
            rule: 'Spell check correction',
            category: 'LANGUAGE'
          });
          
          words[i] = words[i].replace(cleanWord, suggestion.word);
        }
      }
    }

    correctedText = words.join(' ');

    logger.debug('Performed spell check', {
      correlationId,
      correctionsApplied: corrections.length,
      wordsProcessed: words.length
    });

    return { correctedText, corrections };
  }

  private async analyzeTextQuality(
    originalText: string,
    correctedText: string,
    ocrResult: OCRResult,
    correlationId: string
  ): Promise<TextQualityMetrics> {
    
    try {
      // Calculate various quality metrics
      const readabilityScore = this.calculateReadabilityScore(correctedText);
      const confidenceScore = this.calculateOverallConfidence(ocrResult, correctedText);
      const errorRate = this.estimateErrorRate(originalText, correctedText);
      const completenessScore = this.calculateCompletenessScore(ocrResult);
      const structureScore = this.calculateStructureScore(correctedText);
      const languageScore = this.calculateLanguageScore(correctedText);
      const domainRelevanceScore = this.calculateDomainRelevanceScore(correctedText);

      const metrics: TextQualityMetrics = {
        readabilityScore,
        confidenceScore,
        errorRate,
        completenessScore,
        structureScore,
        languageScore,
        domainRelevanceScore
      };

      logger.debug('Analyzed text quality', {
        correlationId,
        metrics
      });

      return metrics;

    } catch (error) {
      logger.error('Failed to analyze text quality', { correlationId, error });
      
      // Return default metrics
      return {
        readabilityScore: 0.5,
        confidenceScore: ocrResult.confidence,
        errorRate: 0.5,
        completenessScore: 0.5,
        structureScore: 0.5,
        languageScore: 0.5,
        domainRelevanceScore: 0.5
      };
    }
  }

  private async applyConfidenceFiltering(
    text: string,
    ocrResult: OCRResult,
    threshold: number,
    correlationId: string
  ): Promise<{ text: string; corrections: any[] }> {
    
    const corrections: any[] = [];
    let filteredText = text;

    // Filter out low-confidence words based on OCR result
    if (ocrResult.pages && ocrResult.pages.length > 0) {
      const words = ocrResult.pages[0].words || [];
      const lowConfidenceWords = words.filter(word => word.confidence < threshold);

      // Replace low-confidence words with placeholders or remove them
      for (const word of lowConfidenceWords) {
        const placeholder = word.confidence < threshold * 0.5 ? '[?]' : `[${word.text}?]`;
        
        corrections.push({
          position: word.bbox.x0,
          length: word.text.length,
          original: word.text,
          corrected: placeholder,
          confidence: word.confidence,
          rule: 'Low confidence filtering',
          category: 'CONFIDENCE_FILTERING'
        });

        filteredText = filteredText.replace(word.text, placeholder);
      }
    }

    logger.debug('Applied confidence filtering', {
      correlationId,
      threshold,
      correctionsApplied: corrections.length
    });

    return { text: filteredText, corrections };
  }

  // Helper methods for quality analysis
  private calculateReadabilityScore(text: string): number {
    // Simple readability calculation based on sentence and word complexity
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgCharsPerWord = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    // Normalize to 0-1 scale (lower is better for readability)
    const complexityScore = (avgWordsPerSentence / 20) + (avgCharsPerWord / 10);
    return Math.max(0, 1 - Math.min(1, complexityScore));
  }

  private calculateOverallConfidence(ocrResult: OCRResult, correctedText: string): number {
    // Base confidence from OCR
    let confidence = ocrResult.confidence;

    // Adjust based on text improvements
    const improvementFactor = correctedText.length > 0 ? 
      Math.min(1.2, correctedText.length / Math.max(1, ocrResult.text.length)) : 1;

    return Math.min(1, confidence * improvementFactor);
  }

  private estimateErrorRate(originalText: string, correctedText: string): number {
    if (originalText.length === 0) return 0;
    
    const distance = this.levenshteinDistance(originalText, correctedText);
    return distance / originalText.length;
  }

  private calculateCompletenessScore(ocrResult: OCRResult): number {
    // Check for missing or incomplete words based on structure
    const words = ocrResult.text.split(/\s+/).filter(w => w.length > 0);
    const completeWords = words.filter(w => w.length > 1 && /^[a-zA-Z0-9]+$/.test(w));
    
    return words.length > 0 ? completeWords.length / words.length : 0;
  }

  private calculateStructureScore(text: string): number {
    // Analyze document structure (paragraphs, lines, formatting)
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const hasProperSpacing = /\s{2,}/.test(text); // Multiple spaces indicate structure
    const hasLineBreaks = lines.length > 1;
    const hasPunctuation = /[.!?,:;]/.test(text);

    let score = 0;
    if (hasLineBreaks) score += 0.3;
    if (hasProperSpacing) score += 0.3;
    if (hasPunctuation) score += 0.4;

    return Math.min(1, score);
  }

  private calculateLanguageScore(text: string): number {
    // Analyze language quality (proper words, grammar patterns)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const recognizedWords = words.filter(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      return this.commonWords.has(cleanWord) || this.domainTerms.has(cleanWord);
    });

    return words.length > 0 ? recognizedWords.length / words.length : 0;
  }

  private calculateDomainRelevanceScore(text: string): number {
    // Calculate relevance to business/order processing domain
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const domainWords = words.filter(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      return this.domainTerms.has(cleanWord);
    });

    return words.length > 0 ? domainWords.length / words.length : 0;
  }

  // Helper methods for text processing
  private cleanupWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();
  }

  private standardizePunctuation(text: string): string {
    return text
      .replace(/\s+([.!?])/g, '$1') // Remove space before punctuation
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure space after sentence-ending punctuation
      .replace(/\s*,\s*/g, ', ') // Standardize comma spacing
      .replace(/\s*:\s*/g, ': ') // Standardize colon spacing
      .replace(/\s*;\s*/g, '; '); // Standardize semicolon spacing
  }

  private findBestDomainMatch(word: string): { term: string; distance: number; confidence: number } | null {
    let bestMatch: { term: string; distance: number; confidence: number } | null = null;

    for (const term of this.domainTerms) {
      const distance = this.levenshteinDistance(word, term);
      const maxLength = Math.max(word.length, term.length);
      const confidence = maxLength > 0 ? 1 - (distance / maxLength) : 0;

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { term, distance, confidence };
      }
    }

    return bestMatch;
  }

  private findBestSpellingSuggestion(word: string): { word: string; confidence: number; distance: number } | null {
    let bestSuggestion: { word: string; confidence: number; distance: number } | null = null;

    // Check against common words
    for (const commonWord of this.commonWords) {
      if (Math.abs(word.length - commonWord.length) > 2) continue; // Skip very different lengths

      const distance = this.levenshteinDistance(word, commonWord);
      const maxLength = Math.max(word.length, commonWord.length);
      const confidence = maxLength > 0 ? 1 - (distance / maxLength) : 0;

      if (distance <= 2 && confidence > 0.7) {
        if (!bestSuggestion || confidence > bestSuggestion.confidence) {
          bestSuggestion = { word: commonWord, confidence, distance };
        }
      }
    }

    return bestSuggestion;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private generateCorrelationId(): string {
    return `textprocessor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for the text post-processor service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    initialized: boolean;
    rulesLoaded: number;
    dictionarySize: number;
    domainTermsSize: number;
  }> {
    try {
      return {
        status: this.initialized ? 'healthy' : 'unhealthy',
        initialized: this.initialized,
        rulesLoaded: Array.from(this.correctionRules.values()).reduce((sum, rules) => sum + rules.length, 0),
        dictionarySize: this.commonWords.size,
        domainTermsSize: this.domainTerms.size
      };
    } catch (error) {
      logger.error('Text post-processor health check failed', { error });
      return {
        status: 'unhealthy',
        initialized: false,
        rulesLoaded: 0,
        dictionarySize: 0,
        domainTermsSize: 0
      };
    }
  }

  /**
   * Advanced semantic context analysis for OCR text
   * Uses context clues to improve word recognition accuracy
   */
  async performSemanticAnalysis(
    text: string, 
    options: TextPostprocessingOptions = {},
    correlationId?: string
  ): Promise<{
    correctedText: string;
    contextualCorrections: number;
    semanticConfidence: number;
  }> {
    const cId = correlationId || this.generateCorrelationId();
    const startTime = Date.now();
    
    try {
      logger.debug('Starting semantic analysis', { correlationId: cId });
      
      let correctedText = text;
      let contextualCorrections = 0;
      
      // Tokenize into sentences for context analysis
      const sentences = this.segmentIntoSentences(text);
      const processedSentences: string[] = [];
      
      for (const sentence of sentences) {
        const words = sentence.split(/\s+/);
        const contextuallyEnhanced = await this.enhanceWordsWithContext(words, cId);
        
        contextualCorrections += contextuallyEnhanced.corrections;
        processedSentences.push(contextuallyEnhanced.enhancedSentence);
      }
      
      correctedText = processedSentences.join(' ');
      
      // Calculate semantic confidence
      const semanticConfidence = this.calculateSemanticConfidence(correctedText);
      
      const processingTime = Date.now() - startTime;
      monitoring.recordTiming('postprocessor.semantic_analysis.duration', processingTime);
      
      logger.info('Semantic analysis completed', {
        correlationId: cId,
        processingTime,
        contextualCorrections,
        semanticConfidence: semanticConfidence.toFixed(3)
      });
      
      return {
        correctedText,
        contextualCorrections,
        semanticConfidence
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      monitoring.recordTiming('postprocessor.semantic_analysis.failed_duration', processingTime);
      monitoring.incrementCounter('postprocessor.semantic_analysis.failed', 1);
      
      logger.error('Semantic analysis failed', { correlationId: cId, error });
      throw error;
    }
  }

  /**
   * Advanced numerical validation and correction for invoices/receipts
   */
  async validateAndCorrectNumericalData(
    text: string,
    correlationId?: string
  ): Promise<{
    correctedText: string;
    numericalCorrections: Array<{
      original: string;
      corrected: string;
      type: 'currency' | 'date' | 'quantity' | 'percentage' | 'phone' | 'id';
      confidence: number;
    }>;
    financialDataIntegrity: number; // 0-1 score
  }> {
    const cId = correlationId || this.generateCorrelationId();
    
    try {
      logger.debug('Starting numerical validation', { correlationId: cId });
      
      let correctedText = text;
      const numericalCorrections: Array<{
        original: string;
        corrected: string;
        type: 'currency' | 'date' | 'quantity' | 'percentage' | 'phone' | 'id';
        confidence: number;
      }> = [];
      
      // Currency validation and correction
      const currencyPatterns = [
        { pattern: /\$\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/g, type: 'currency' as const },
        { pattern: /(\d{1,3}(?:,\d{3})*\.?\d{0,2})\s*\$/g, type: 'currency' as const },
        { pattern: /USD\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/g, type: 'currency' as const },
      ];
      
      for (const { pattern, type } of currencyPatterns) {
        correctedText = correctedText.replace(pattern, (match, amount) => {
          const cleanAmount = amount.replace(/[^\d.,]/g, '');
          const corrected = this.validateCurrencyFormat(cleanAmount);
          
          if (corrected !== cleanAmount) {
            numericalCorrections.push({
              original: match,
              corrected: `$${corrected}`,
              type,
              confidence: 0.9
            });
          }
          
          return `$${corrected}`;
        });
      }
      
      // Date validation and correction
      const datePatterns = [
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
        /(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{2,4})/gi
      ];
      
      for (const pattern of datePatterns) {
        correctedText = correctedText.replace(pattern, (match) => {
          const corrected = this.correctDateFormat(match);
          
          if (corrected !== match) {
            numericalCorrections.push({
              original: match,
              corrected,
              type: 'date',
              confidence: 0.85
            });
          }
          
          return corrected;
        });
      }
      
      // Phone number correction
      const phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
      correctedText = correctedText.replace(phonePattern, (match) => {
        const corrected = this.standardizePhoneNumber(match);
        
        if (corrected !== match) {
          numericalCorrections.push({
            original: match,
            corrected,
            type: 'phone',
            confidence: 0.8
          });
        }
        
        return corrected;
      });
      
      // Calculate financial data integrity
      const financialDataIntegrity = this.assessFinancialDataIntegrity(correctedText);
      
      logger.info('Numerical validation completed', {
        correlationId: cId,
        correctionsCount: numericalCorrections.length,
        financialDataIntegrity: financialDataIntegrity.toFixed(3)
      });
      
      return {
        correctedText,
        numericalCorrections,
        financialDataIntegrity
      };
      
    } catch (error) {
      logger.error('Numerical validation failed', { correlationId: cId, error });
      throw error;
    }
  }

  /**
   * Structure-aware text reconstruction for complex documents
   */
  async reconstructDocumentStructure(
    text: string,
    layoutHints?: {
      hasTable: boolean;
      hasHeader: boolean;
      hasFooter: boolean;
      columnCount?: number;
    },
    correlationId?: string
  ): Promise<{
    structuredText: string;
    detectedElements: Array<{
      type: 'header' | 'body' | 'footer' | 'table' | 'list' | 'address' | 'total';
      content: string;
      confidence: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>;
    structuralIntegrity: number;
  }> {
    const cId = correlationId || this.generateCorrelationId();
    
    try {
      logger.debug('Starting document structure reconstruction', { correlationId: cId });
      
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      const detectedElements: Array<{
        type: 'header' | 'body' | 'footer' | 'table' | 'list' | 'address' | 'total';
        content: string;
        confidence: number;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }> = [];
      
      // Detect document elements
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Header detection (typically first few lines, company names, logos)
        if (i < 3 && (this.isCompanyName(line) || this.isHeader(line))) {
          detectedElements.push({
            type: 'header',
            content: line,
            confidence: 0.8
          });
        }
        
        // Table detection
        else if (this.isTableRow(line)) {
          const tableContent = this.extractTableSection(lines, i);
          detectedElements.push({
            type: 'table',
            content: tableContent.content,
            confidence: tableContent.confidence
          });
          i += tableContent.linesConsumed - 1; // Skip processed lines
        }
        
        // Address detection
        else if (this.isAddress(line)) {
          const addressContent = this.extractAddressSection(lines, i);
          detectedElements.push({
            type: 'address',
            content: addressContent.content,
            confidence: addressContent.confidence
          });
          i += addressContent.linesConsumed - 1;
        }
        
        // Total/amount detection
        else if (this.isTotalLine(line)) {
          detectedElements.push({
            type: 'total',
            content: line,
            confidence: 0.9
          });
        }
        
        // Footer detection (typically last few lines)
        else if (i > lines.length - 4 && this.isFooter(line)) {
          detectedElements.push({
            type: 'footer',
            content: line,
            confidence: 0.7
          });
        }
        
        // List detection
        else if (this.isListItem(line)) {
          detectedElements.push({
            type: 'list',
            content: line,
            confidence: 0.6
          });
        }
        
        // Default to body content
        else {
          detectedElements.push({
            type: 'body',
            content: line,
            confidence: 0.5
          });
        }
      }
      
      // Reconstruct structured text
      const structuredText = this.reconstructFromElements(detectedElements);
      
      // Calculate structural integrity
      const structuralIntegrity = this.calculateStructuralIntegrity(detectedElements);
      
      logger.info('Document structure reconstruction completed', {
        correlationId: cId,
        elementsDetected: detectedElements.length,
        structuralIntegrity: structuralIntegrity.toFixed(3)
      });
      
      return {
        structuredText,
        detectedElements,
        structuralIntegrity
      };
      
    } catch (error) {
      logger.error('Document structure reconstruction failed', { correlationId: cId, error });
      throw error;
    }
  }

  // Helper methods for advanced processing

  private segmentIntoSentences(text: string): string[] {
    // More sophisticated sentence segmentation considering business context
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  private async enhanceWordsWithContext(
    words: string[], 
    correlationId: string
  ): Promise<{ enhancedSentence: string; corrections: number }> {
    let corrections = 0;
    const enhancedWords: string[] = [];
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const context = {
        previous: words[i - 1] || '',
        next: words[i + 1] || '',
        position: i,
        sentenceLength: words.length
      };
      
      const enhanced = this.enhanceWordWithContext(word, context);
      enhancedWords.push(enhanced.word);
      
      if (enhanced.wasChanged) {
        corrections++;
      }
    }
    
    return {
      enhancedSentence: enhancedWords.join(' '),
      corrections
    };
  }

  private enhanceWordWithContext(
    word: string, 
    context: { previous: string; next: string; position: number; sentenceLength: number }
  ): { word: string; wasChanged: boolean } {
    // Context-aware corrections based on surrounding words
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    // Business context patterns
    if (context.previous.toLowerCase().includes('total') && /^\d/.test(word)) {
      // Likely a currency amount after "total"
      const corrected = this.correctCurrencyInContext(word);
      return { word: corrected, wasChanged: corrected !== word };
    }
    
    if (context.previous.toLowerCase().includes('qty') || context.previous.toLowerCase().includes('quantity')) {
      // Likely a quantity
      const corrected = this.correctQuantityInContext(word);
      return { word: corrected, wasChanged: corrected !== word };
    }
    
    if (/^[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}$/.test(word)) {
      // Likely a date
      const corrected = this.correctDateFormat(word);
      return { word: corrected, wasChanged: corrected !== word };
    }
    
    // Default enhancement
    return { word, wasChanged: false };
  }

  private calculateSemanticConfidence(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const recognizedWords = words.filter(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      return this.commonWords.has(cleanWord) || this.domainTerms.has(cleanWord);
    });
    
    return words.length > 0 ? recognizedWords.length / words.length : 0;
  }

  private validateCurrencyFormat(amount: string): string {
    // Remove invalid characters and ensure proper decimal formatting
    const cleaned = amount.replace(/[^\d.,]/g, '');
    const parts = cleaned.split('.');
    
    if (parts.length > 2) {
      // Multiple decimals, keep only the last one
      const beforeDecimal = parts.slice(0, -1).join('');
      const afterDecimal = parts[parts.length - 1];
      return `${beforeDecimal}.${afterDecimal.substring(0, 2)}`;
    }
    
    if (parts.length === 2) {
      // Ensure decimal part is max 2 digits
      return `${parts[0]}.${parts[1].substring(0, 2)}`;
    }
    
    return cleaned;
  }

  private correctDateFormat(dateStr: string): string {
    // Standardize date format to MM/DD/YYYY
    const datePatterns = [
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/,
      /^(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/
    ];
    
    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        let [, part1, part2, part3] = match;
        
        // Convert 2-digit year to 4-digit
        if (part3.length === 2) {
          const year = parseInt(part3);
          part3 = year < 50 ? `20${part3}` : `19${part3}`;
        }
        
        // Determine if first pattern is MM/DD/YYYY or DD/MM/YYYY
        const month = parseInt(part1);
        const day = parseInt(part2);
        
        if (month > 12 && day <= 12) {
          // Swap if first part is clearly day
          return `${part2.padStart(2, '0')}/${part1.padStart(2, '0')}/${part3}`;
        }
        
        return `${part1.padStart(2, '0')}/${part2.padStart(2, '0')}/${part3}`;
      }
    }
    
    return dateStr;
  }

  private standardizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      const tenDigit = digits.substring(1);
      return `+1 (${tenDigit.substring(0, 3)}) ${tenDigit.substring(3, 6)}-${tenDigit.substring(6)}`;
    }
    
    return phone;
  }

  private assessFinancialDataIntegrity(text: string): number {
    // Calculate how well financial data appears to be preserved/correct
    const currencyMatches = text.match(/\$\d+(\.\d{2})?/g) || [];
    const percentageMatches = text.match(/\d+(\.\d+)?%/g) || [];
    const quantityMatches = text.match(/qty:?\s*\d+/gi) || [];
    
    let integrity = 0.5; // Base score
    
    // Bonus for finding expected financial elements
    if (currencyMatches.length > 0) integrity += 0.2;
    if (percentageMatches.length > 0) integrity += 0.1;
    if (quantityMatches.length > 0) integrity += 0.1;
    
    // Check for consistency in currency formatting
    const wellFormattedCurrency = currencyMatches.filter(match => 
      /^\$\d{1,3}(,\d{3})*(\.\d{2})?$/.test(match)
    );
    
    if (currencyMatches.length > 0) {
      integrity += (wellFormattedCurrency.length / currencyMatches.length) * 0.1;
    }
    
    return Math.min(1, integrity);
  }

  private correctCurrencyInContext(word: string): string {
    // OCR often confuses currency symbols and decimal points
    let corrected = word
      .replace(/[O0]/g, '0') // O to 0
      .replace(/[l1I]/g, '1') // l, I to 1
      .replace(/S/g, '5') // S to 5
      .replace(/[^0-9.,]/g, ''); // Remove non-numeric except decimal and comma
    
    // Ensure proper decimal formatting
    if (corrected.includes('.')) {
      const parts = corrected.split('.');
      if (parts.length === 2 && parts[1].length > 2) {
        corrected = `${parts[0]}.${parts[1].substring(0, 2)}`;
      }
    }
    
    return corrected;
  }

  private correctQuantityInContext(word: string): string {
    // Quantities should be integers
    return word
      .replace(/[O0]/g, '0')
      .replace(/[l1I]/g, '1')
      .replace(/[S5]/g, '5')
      .replace(/[^0-9]/g, '');
  }

  // Document structure analysis helpers

  private isCompanyName(line: string): boolean {
    const companyIndicators = ['inc', 'corp', 'llc', 'ltd', 'company', 'co.', '&'];
    return companyIndicators.some(indicator => 
      line.toLowerCase().includes(indicator)
    );
  }

  private isHeader(line: string): boolean {
    const headerIndicators = ['invoice', 'receipt', 'bill', 'statement', 'order'];
    return headerIndicators.some(indicator => 
      line.toLowerCase().includes(indicator)
    ) && line.length < 50;
  }

  private isTableRow(line: string): boolean {
    // Look for tabular data patterns
    const tabPatterns = [
      /\|\s*[^|]+\s*\|/,  // Pipe-separated
      /\t+/,              // Tab-separated
      /\s{5,}/            // Multiple spaces (columns)
    ];
    
    return tabPatterns.some(pattern => pattern.test(line));
  }

  private isAddress(line: string): boolean {
    const addressIndicators = [
      /\d+\s+[a-zA-Z\s]+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane)/i,
      /\d{5}(-\d{4})?$/, // ZIP code
      /(apt|apartment|suite|unit)\s*\d+/i
    ];
    
    return addressIndicators.some(pattern => pattern.test(line));
  }

  private isTotalLine(line: string): boolean {
    const totalIndicators = ['total', 'subtotal', 'amount due', 'balance', 'grand total'];
    return totalIndicators.some(indicator => 
      line.toLowerCase().includes(indicator)
    ) && /\$?\d+(\.\d{2})?/.test(line);
  }

  private isFooter(line: string): boolean {
    const footerIndicators = ['thank you', 'questions', 'contact', 'website', 'phone'];
    return footerIndicators.some(indicator => 
      line.toLowerCase().includes(indicator)
    );
  }

  private isListItem(line: string): boolean {
    return /^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
  }

  private extractTableSection(lines: string[], startIndex: number): {
    content: string;
    confidence: number;
    linesConsumed: number;
  } {
    const tableLines = [lines[startIndex]];
    let i = startIndex + 1;
    
    while (i < lines.length && this.isTableRow(lines[i])) {
      tableLines.push(lines[i]);
      i++;
    }
    
    return {
      content: tableLines.join('\n'),
      confidence: tableLines.length > 2 ? 0.9 : 0.6,
      linesConsumed: tableLines.length
    };
  }

  private extractAddressSection(lines: string[], startIndex: number): {
    content: string;
    confidence: number;
    linesConsumed: number;
  } {
    const addressLines = [lines[startIndex]];
    let i = startIndex + 1;
    
    // Look for continuation of address (next 2-3 lines)
    while (i < lines.length && i < startIndex + 3) {
      const line = lines[i];
      if (this.isAddress(line) || /^\d{5}(-\d{4})?$/.test(line.trim())) {
        addressLines.push(line);
      } else {
        break;
      }
      i++;
    }
    
    return {
      content: addressLines.join('\n'),
      confidence: addressLines.length > 1 ? 0.8 : 0.6,
      linesConsumed: addressLines.length
    };
  }

  private reconstructFromElements(elements: Array<{
    type: string;
    content: string;
    confidence: number;
  }>): string {
    // Organize elements by type and reconstruct logical document flow
    const structured: string[] = [];
    
    // Headers first
    const headers = elements.filter(e => e.type === 'header');
    if (headers.length > 0) {
      structured.push('=== HEADER ===');
      headers.forEach(h => structured.push(h.content));
      structured.push('');
    }
    
    // Address
    const addresses = elements.filter(e => e.type === 'address');
    if (addresses.length > 0) {
      structured.push('=== ADDRESS ===');
      addresses.forEach(a => structured.push(a.content));
      structured.push('');
    }
    
    // Body content and tables
    const bodyElements = elements.filter(e => ['body', 'table', 'list'].includes(e.type));
    if (bodyElements.length > 0) {
      structured.push('=== CONTENT ===');
      bodyElements.forEach(b => structured.push(b.content));
      structured.push('');
    }
    
    // Totals
    const totals = elements.filter(e => e.type === 'total');
    if (totals.length > 0) {
      structured.push('=== TOTALS ===');
      totals.forEach(t => structured.push(t.content));
      structured.push('');
    }
    
    // Footer
    const footers = elements.filter(e => e.type === 'footer');
    if (footers.length > 0) {
      structured.push('=== FOOTER ===');
      footers.forEach(f => structured.push(f.content));
    }
    
    return structured.join('\n');
  }

  private calculateStructuralIntegrity(elements: Array<{
    type: string;
    content: string;
    confidence: number;
  }>): number {
    if (elements.length === 0) return 0;
    
    // Calculate average confidence
    const avgConfidence = elements.reduce((sum, e) => sum + e.confidence, 0) / elements.length;
    
    // Bonus for having expected document structure
    let structureBonus = 0;
    const types = new Set(elements.map(e => e.type));
    
    if (types.has('header')) structureBonus += 0.1;
    if (types.has('total')) structureBonus += 0.1;
    if (types.has('address')) structureBonus += 0.05;
    if (types.has('table')) structureBonus += 0.05;
    
    return Math.min(1, avgConfidence + structureBonus);
  }
}

// Export singleton instance
export const textPostProcessorService = TextPostProcessorService.getInstance();