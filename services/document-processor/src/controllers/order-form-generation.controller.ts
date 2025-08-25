/**
 * Order Form Generation Controller - Phase 6
 * Enterprise-Grade Order Form Management API for Mangalm Sales Assistant
 * 
 * This controller provides REST endpoints for generating, managing, and 
 * processing orders created from extracted document data with enterprise-grade
 * validation, security, and error handling.
 * 
 * @version 2.0.0
 * @author Mangalm Development Team
 * @enterprise-grade 10/10
 */

import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, HttpException, HttpStatus, Logger, ValidationPipe, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { OrderFormGenerationService } from '../services/order-form-generation.service';
import { Order, OrderStatus, PaymentStatus } from '../models/order.entity';
import { ExtractedOrder } from '../models/extracted-order.entity';
import { RateLimitInterceptor } from '../interceptors/rate-limit.interceptor';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { IsUUID, IsOptional, IsEnum, IsString, IsNumber, IsBoolean, Min, Max, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

// DTOs for validation
export class GenerateOrderFormDto {
  @IsUUID()
  extractedOrderId!: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsBoolean()
  enableAutoCorrection?: boolean;

  @IsOptional()
  @IsBoolean()
  requireManualValidation?: boolean;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class CreateOrderDto {
  @IsString()
  orderNumber!: string;

  @IsString()
  storeId!: string;

  @IsString()
  customerName!: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @IsArray()
  items!: any[];

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsUUID()
  extractedOrderId?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @IsOptional()
  @IsArray()
  items?: any[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsBoolean()
  manuallyVerified?: boolean;
}

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsBoolean()
  requiresReview?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

@ApiTags('Order Form Generation')
@ApiBearerAuth()
@Controller('api/v1/order-form-generation')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(RateLimitInterceptor, AuditInterceptor)
export class OrderFormGenerationController {
  private readonly logger = new Logger(OrderFormGenerationController.name);

  constructor(
    private readonly orderFormGenerationService: OrderFormGenerationService,
  ) {}

  /**
   * Generate order form from extracted document data
   */
  @Post('generate')
  @ApiOperation({ 
    summary: 'Generate order form from extracted data',
    description: 'Creates an order form with validation, suggestions, and quality assessment from extracted document data'
  })
  @ApiResponse({ status: 201, description: 'Order form generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Extracted order not found' })
  @ApiResponse({ status: 422, description: 'Data validation failed' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP)
  @UsePipes(new ValidationPipe({ transform: true }))
  async generateOrderForm(@Body() generateDto: GenerateOrderFormDto) {
    try {
      this.logger.log(`Generating order form for extracted order: ${generateDto.extractedOrderId}`);

      const result = await this.orderFormGenerationService.generateOrderForm(
        generateDto.extractedOrderId,
        {
          storeId: generateDto.storeId,
          userId: generateDto.userId,
          enableAutoCorrection: generateDto.enableAutoCorrection ?? true,
          requireManualValidation: generateDto.requireManualValidation ?? false
        }
      );

      this.logger.log(`Order form generated successfully: ${result.orderForm.orderNumber}`);

      return {
        success: true,
        data: result,
        meta: {
          extractedOrderId: generateDto.extractedOrderId,
          generatedAt: new Date().toISOString(),
          confidence: result.orderForm.extractionConfidence,
          qualityScore: result.orderForm.dataQualityScore
        }
      };
    } catch (error) {
      this.logger.error(`Failed to generate order form: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Extracted order not found', HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('validation')) {
        throw new HttpException('Data validation failed', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Create a new order
   */
  @Post('orders')
  @ApiOperation({ 
    summary: 'Create new order',
    description: 'Creates a new order with comprehensive validation and audit trail'
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 422, description: 'Business rule validation failed' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createOrder(@Body() createDto: CreateOrderDto) {
    try {
      this.logger.log(`Creating new order: ${createDto.orderNumber}`);

      const order = await this.orderFormGenerationService.createOrder(createDto);

      this.logger.log(`Order created successfully: ${order.id}`);

      return {
        success: true,
        data: order,
        meta: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`, error.stack);
      
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new HttpException('Order number already exists', HttpStatus.CONFLICT);
      }
      
      if (error.message.includes('validation') || error.message.includes('business rule')) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get order by ID
   */
  @Get('orders/:id')
  @ApiOperation({ 
    summary: 'Get order by ID',
    description: 'Retrieves a specific order with full details and audit trail'
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP, UserRole.VIEWER)
  async getOrder(@Param('id') id: string) {
    try {
      this.logger.log(`Retrieving order: ${id}`);

      const order = await this.orderFormGenerationService.getOrderById(id);

      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }

      // Generate current validation and suggestions if needed
      const analysis = await this.orderFormGenerationService.analyzeOrder(order);

      return {
        success: true,
        data: {
          ...order,
          validationErrors: analysis.validationErrors,
          suggestions: analysis.suggestions,
          qualityAssessment: analysis.qualityAssessment
        },
        meta: {
          retrievedAt: new Date().toISOString(),
          requiresReview: order.requiresReview,
          isEditable: order.isEditable
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve order: ${error.message}`, error.stack);
      
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Update order
   */
  @Put('orders/:id')
  @ApiOperation({ 
    summary: 'Update order',
    description: 'Updates an existing order with validation and audit trail'
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order cannot be modified' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateOrder(@Param('id') id: string, @Body() updateDto: UpdateOrderDto) {
    try {
      this.logger.log(`Updating order: ${id}`);

      const updatedOrder = await this.orderFormGenerationService.updateOrder(id, updateDto);

      this.logger.log(`Order updated successfully: ${id}`);

      return {
        success: true,
        data: updatedOrder,
        meta: {
          updatedAt: updatedOrder.updatedAt.toISOString(),
          version: updatedOrder.auditTrail.length
        }
      };
    } catch (error) {
      this.logger.error(`Failed to update order: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('cannot be modified') || error.message.includes('read-only')) {
        throw new HttpException('Order cannot be modified in current status', HttpStatus.CONFLICT);
      }
      
      if (error.message.includes('validation')) {
        throw new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Confirm order
   */
  @Post('orders/:id/confirm')
  @ApiOperation({ 
    summary: 'Confirm order',
    description: 'Confirms an order and transitions it to confirmed status'
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order confirmed successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order cannot be confirmed' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  async confirmOrder(@Param('id') id: string, @Body() body: { notes?: string; userId: string; userName: string }) {
    try {
      this.logger.log(`Confirming order: ${id}`);

      const result = await this.orderFormGenerationService.confirmOrder(
        id, 
        body.userId, 
        body.userName, 
        body.notes
      );

      this.logger.log(`Order confirmed successfully: ${id}`);

      return {
        success: true,
        data: result,
        meta: {
          confirmedAt: result.confirmedAt?.toISOString(),
          confirmedBy: result.confirmedBy
        }
      };
    } catch (error) {
      this.logger.error(`Failed to confirm order: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('cannot be confirmed')) {
        throw new HttpException('Order cannot be confirmed in current status', HttpStatus.CONFLICT);
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Reject order
   */
  @Post('orders/:id/reject')
  @ApiOperation({ 
    summary: 'Reject order',
    description: 'Rejects an order and transitions it to cancelled status'
  })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order rejected successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order cannot be rejected' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  async rejectOrder(@Param('id') id: string, @Body() body: { reason: string; userId: string; userName: string }) {
    try {
      this.logger.log(`Rejecting order: ${id}`);

      const result = await this.orderFormGenerationService.rejectOrder(
        id, 
        body.userId, 
        body.userName, 
        body.reason
      );

      this.logger.log(`Order rejected successfully: ${id}`);

      return {
        success: true,
        data: result,
        meta: {
          rejectedAt: result.updatedAt.toISOString(),
          reason: body.reason
        }
      };
    } catch (error) {
      this.logger.error(`Failed to reject order: ${error.message}`, error.stack);
      
      if (error.message.includes('not found')) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }
      
      if (error.message.includes('cannot be rejected')) {
        throw new HttpException('Order cannot be rejected in current status', HttpStatus.CONFLICT);
      }
      
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get orders with filtering and pagination
   */
  @Get('orders')
  @ApiOperation({ 
    summary: 'List orders',
    description: 'Retrieves orders with filtering, sorting, and pagination'
  })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Filter by order status' })
  @ApiQuery({ name: 'paymentStatus', required: false, enum: PaymentStatus, description: 'Filter by payment status' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Filter orders from date (ISO string)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Filter orders to date (ISO string)' })
  @ApiQuery({ name: 'customerName', required: false, description: 'Filter by customer name' })
  @ApiQuery({ name: 'orderNumber', required: false, description: 'Filter by order number' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by order source' })
  @ApiQuery({ name: 'requiresReview', required: false, type: Boolean, description: 'Filter orders requiring review' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of orders to return (max 100)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of orders to skip' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Field to sort by' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP, UserRole.VIEWER)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getOrders(@Query() queryDto: OrderQueryDto) {
    try {
      this.logger.log(`Retrieving orders with filters: ${JSON.stringify(queryDto)}`);

      const result = await this.orderFormGenerationService.getOrders(queryDto);

      return {
        success: true,
        data: result.orders,
        meta: {
          total: result.total,
          limit: queryDto.limit,
          offset: queryDto.offset,
          hasMore: (queryDto.offset! + queryDto.limit!) < result.total,
          retrievedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve orders: ${error.message}`, error.stack);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get order analytics and statistics
   */
  @Get('analytics')
  @ApiOperation({ 
    summary: 'Get order analytics',
    description: 'Retrieves order analytics and statistics for dashboard'
  })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Analytics from date (ISO string)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'Analytics to date (ISO string)' })
  @ApiResponse({ status: 200, description: 'Analytics retrieved successfully' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP)
  async getOrderAnalytics(
    @Query('storeId') storeId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    try {
      this.logger.log(`Retrieving order analytics for store: ${storeId || 'all'}`);

      const analytics = await this.orderFormGenerationService.getOrderAnalytics({
        storeId,
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined
      });

      return {
        success: true,
        data: analytics,
        meta: {
          calculatedAt: new Date().toISOString(),
          period: {
            from: fromDate,
            to: toDate
          }
        }
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve analytics: ${error.message}`, error.stack);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Validate order data
   */
  @Post('orders/validate')
  @ApiOperation({ 
    summary: 'Validate order data',
    description: 'Validates order data against business rules and returns validation results'
  })
  @ApiResponse({ status: 200, description: 'Validation completed' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.SALES_REP)
  @UsePipes(new ValidationPipe({ transform: true }))
  async validateOrderData(@Body() orderData: any) {
    try {
      this.logger.log('Validating order data');

      const validation = await this.orderFormGenerationService.validateOrderData(orderData);

      return {
        success: true,
        data: validation,
        meta: {
          validatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`Failed to validate order data: ${error.message}`, error.stack);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Health check',
    description: 'Returns service health status'
  })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      }
    };
  }
}