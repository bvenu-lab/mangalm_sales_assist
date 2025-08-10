import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';

interface DataPoint {
  x: number | Date;
  y: number;
  label?: string;
}

interface EnterpriseLineChartProps {
  data: DataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  width?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
}

/**
 * Enterprise-grade Line Chart Component
 * Built with Canvas API for high performance
 */
const EnterpriseLineChart: React.FC<EnterpriseLineChartProps> = ({
  data,
  title,
  xLabel = '',
  yLabel = '',
  height = 400,
  width,
  color,
  showGrid = true,
  showTooltip = true,
  animate = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const animationRef = useRef<number>();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const chartColor = color || theme.palette.primary.main;

  // Calculate chart dimensions
  const dimensions = useMemo(() => {
    const padding = { top: 40, right: 40, bottom: 60, left: 80 };
    const actualWidth = width || containerRef.current?.offsetWidth || 800;
    const chartWidth = actualWidth - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    return { 
      width: actualWidth, 
      height, 
      chartWidth, 
      chartHeight, 
      padding 
    };
  }, [width, height]);

  // Calculate data bounds
  const bounds = useMemo(() => {
    if (data.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    
    const xValues = data.map(d => typeof d.x === 'number' ? d.x : d.x.getTime());
    const yValues = data.map(d => d.y);
    
    return {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues) * 0.9,
      maxY: Math.max(...yValues) * 1.1,
    };
  }, [data]);

  // Scale functions
  const scaleX = (value: number | Date) => {
    const x = typeof value === 'number' ? value : value.getTime();
    const { minX, maxX } = bounds;
    const { chartWidth, padding } = dimensions;
    return padding.left + ((x - minX) / (maxX - minX)) * chartWidth;
  };

  const scaleY = (value: number) => {
    const { minY, maxY } = bounds;
    const { chartHeight, padding } = dimensions;
    return dimensions.height - padding.bottom - ((value - minY) / (maxY - minY)) * chartHeight;
  };

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Animation setup
    let progress = 0;
    const animationDuration = animate ? 1000 : 0;
    const startTime = Date.now();

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw background
      ctx.fillStyle = theme.palette.background.paper;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw grid
      if (showGrid) {
        ctx.strokeStyle = theme.palette.divider;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([5, 5]);

        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
          const x = dimensions.padding.left + (dimensions.chartWidth / 10) * i;
          ctx.beginPath();
          ctx.moveTo(x, dimensions.padding.top);
          ctx.lineTo(x, dimensions.height - dimensions.padding.bottom);
          ctx.stroke();
        }

        // Horizontal grid lines
        for (let i = 0; i <= 8; i++) {
          const y = dimensions.padding.top + (dimensions.chartHeight / 8) * i;
          ctx.beginPath();
          ctx.moveTo(dimensions.padding.left, y);
          ctx.lineTo(dimensions.width - dimensions.padding.right, y);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      // Draw axes
      ctx.strokeStyle = theme.palette.text.primary;
      ctx.lineWidth = 2;
      
      // X-axis
      ctx.beginPath();
      ctx.moveTo(dimensions.padding.left, dimensions.height - dimensions.padding.bottom);
      ctx.lineTo(dimensions.width - dimensions.padding.right, dimensions.height - dimensions.padding.bottom);
      ctx.stroke();

      // Y-axis
      ctx.beginPath();
      ctx.moveTo(dimensions.padding.left, dimensions.padding.top);
      ctx.lineTo(dimensions.padding.left, dimensions.height - dimensions.padding.bottom);
      ctx.stroke();

      // Draw axis labels
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.font = '12px Roboto, sans-serif';
      ctx.textAlign = 'center';
      
      // X-axis labels
      for (let i = 0; i <= 5; i++) {
        const value = bounds.minX + (bounds.maxX - bounds.minX) * (i / 5);
        const x = scaleX(value);
        const label = data[0]?.x instanceof Date 
          ? new Date(value).toLocaleDateString()
          : value.toFixed(0);
        
        ctx.fillText(label, x, dimensions.height - dimensions.padding.bottom + 20);
      }

      // Y-axis labels
      ctx.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const value = bounds.minY + (bounds.maxY - bounds.minY) * (i / 5);
        const y = scaleY(value);
        ctx.fillText(value.toFixed(0), dimensions.padding.left - 10, y + 5);
      }

      // Draw axis titles
      ctx.font = 'bold 14px Roboto, sans-serif';
      ctx.fillStyle = theme.palette.text.primary;
      
      // X-axis title
      if (xLabel) {
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, dimensions.width / 2, dimensions.height - 10);
      }

      // Y-axis title
      if (yLabel) {
        ctx.save();
        ctx.translate(20, dimensions.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
      }

      // Calculate animation progress
      if (animate) {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / animationDuration, 1);
      } else {
        progress = 1;
      }

      // Draw line with gradient
      const gradient = ctx.createLinearGradient(0, dimensions.padding.top, 0, dimensions.height - dimensions.padding.bottom);
      gradient.addColorStop(0, chartColor);
      gradient.addColorStop(1, `${chartColor}33`);

      // Draw area fill
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      const animatedData = data.slice(0, Math.floor(data.length * progress));
      
      if (animatedData.length > 0) {
        ctx.moveTo(scaleX(animatedData[0].x), dimensions.height - dimensions.padding.bottom);
        animatedData.forEach(point => {
          ctx.lineTo(scaleX(point.x), scaleY(point.y));
        });
        ctx.lineTo(scaleX(animatedData[animatedData.length - 1].x), dimensions.height - dimensions.padding.bottom);
        ctx.closePath();
        ctx.fill();
      }

      // Draw line
      ctx.globalAlpha = 1;
      ctx.strokeStyle = chartColor;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      animatedData.forEach((point, index) => {
        const x = scaleX(point.x);
        const y = scaleY(point.y);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw points
      ctx.fillStyle = chartColor;
      animatedData.forEach(point => {
        const x = scaleX(point.x);
        const y = scaleY(point.y);
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw white center
        ctx.fillStyle = theme.palette.background.paper;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = chartColor;
      });

      // Continue animation
      if (progress < 1 && animate) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [data, dimensions, bounds, theme, chartColor, showGrid, animate, xLabel, yLabel]);

  // Handle mouse interaction for tooltips
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showTooltip || !canvasRef.current || !tooltipRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find nearest data point
    let nearestPoint: DataPoint | null = null;
    let minDistance = Infinity;

    data.forEach(point => {
      const px = scaleX(point.x);
      const py = scaleY(point.y);
      const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
      
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        nearestPoint = point;
      }
    });

    if (nearestPoint) {
      const tooltip = tooltipRef.current;
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX - rect.left + 10}px`;
      tooltip.style.top = `${e.clientY - rect.top - 30}px`;
      tooltip.innerHTML = `
        <div style="background: ${theme.palette.background.paper}; 
                    border: 1px solid ${theme.palette.divider}; 
                    padding: 8px; 
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
          <div style="color: ${theme.palette.text.primary}; font-weight: bold;">
            ${(nearestPoint as any).label || (nearestPoint as any).x}
          </div>
          <div style="color: ${theme.palette.text.secondary};">
            Value: ${((nearestPoint as any).y || 0).toLocaleString()}
          </div>
        </div>
      `;
    } else {
      tooltipRef.current.style.display = 'none';
    }
  };

  const handleMouseLeave = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = 'none';
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, position: 'relative' }}>
      {title && (
        <Typography variant="h6" gutterBottom align="center">
          {title}
        </Typography>
      )}
      <Box ref={containerRef} position="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', cursor: showTooltip ? 'crosshair' : 'default' }}
        />
        {showTooltip && (
          <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              display: 'none',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default EnterpriseLineChart;