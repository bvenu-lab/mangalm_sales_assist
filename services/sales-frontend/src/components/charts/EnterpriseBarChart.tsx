import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';

interface BarData {
  label: string;
  value: number;
  color?: string;
  subLabel?: string;
}

interface EnterpriseBarChartProps {
  data: BarData[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  width?: number;
  orientation?: 'vertical' | 'horizontal';
  showValues?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  colorScheme?: 'primary' | 'secondary' | 'gradient' | 'custom';
}

/**
 * Enterprise-grade Bar Chart Component
 * High-performance canvas rendering with animations
 */
const EnterpriseBarChart: React.FC<EnterpriseBarChartProps> = ({
  data,
  title,
  xLabel = '',
  yLabel = '',
  height = 400,
  width,
  orientation = 'vertical',
  showValues = true,
  showGrid = true,
  animate = true,
  colorScheme = 'primary',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const animationRef = useRef<number>();
  const hoverRef = useRef<number>(-1);

  // Calculate dimensions
  const dimensions = useMemo(() => {
    const padding = { top: 40, right: 40, bottom: 80, left: 80 };
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

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value)) * 1.1;
  }, [data]);

  // Generate colors based on scheme
  const getBarColor = (index: number, item: BarData) => {
    if (item.color) return item.color;
    
    switch (colorScheme) {
      case 'primary':
        return theme.palette.primary.main;
      case 'secondary':
        return theme.palette.secondary.main;
      case 'gradient':
        const gradientColors = [
          theme.palette.primary.main,
          theme.palette.secondary.main,
          theme.palette.success.main,
          theme.palette.warning.main,
          theme.palette.info.main,
        ];
        return gradientColors[index % gradientColors.length];
      default:
        return theme.palette.primary.main;
    }
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
    const animationDuration = animate ? 800 : 0;
    const startTime = Date.now();

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw background
      ctx.fillStyle = theme.palette.background.paper;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Calculate animation progress
      if (animate) {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / animationDuration, 1);
        // Easing function
        progress = 1 - Math.pow(1 - progress, 3);
      } else {
        progress = 1;
      }

      // Draw grid
      if (showGrid) {
        ctx.strokeStyle = theme.palette.divider;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([5, 5]);

        if (orientation === 'vertical') {
          // Horizontal grid lines
          for (let i = 0; i <= 10; i++) {
            const y = dimensions.padding.top + (dimensions.chartHeight / 10) * i;
            ctx.beginPath();
            ctx.moveTo(dimensions.padding.left, y);
            ctx.lineTo(dimensions.width - dimensions.padding.right, y);
            ctx.stroke();
          }
        } else {
          // Vertical grid lines
          for (let i = 0; i <= 10; i++) {
            const x = dimensions.padding.left + (dimensions.chartWidth / 10) * i;
            ctx.beginPath();
            ctx.moveTo(x, dimensions.padding.top);
            ctx.lineTo(x, dimensions.height - dimensions.padding.bottom);
            ctx.stroke();
          }
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

      // Draw Y-axis labels (values)
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.font = '12px Roboto, sans-serif';
      ctx.textAlign = 'right';
      
      if (orientation === 'vertical') {
        for (let i = 0; i <= 5; i++) {
          const value = (maxValue / 5) * i;
          const y = dimensions.height - dimensions.padding.bottom - (dimensions.chartHeight / 5) * i;
          ctx.fillText(value.toFixed(0), dimensions.padding.left - 10, y + 5);
        }
      }

      // Draw bars
      const barWidth = dimensions.chartWidth / (data.length * 1.5);
      const barSpacing = barWidth * 0.5;

      data.forEach((item, index) => {
        const barHeight = (item.value / maxValue) * dimensions.chartHeight * progress;
        const x = dimensions.padding.left + barSpacing + index * (barWidth + barSpacing);
        const y = dimensions.height - dimensions.padding.bottom - barHeight;

        // Check if bar is hovered
        const isHovered = hoverRef.current === index;

        // Draw bar shadow
        if (isHovered) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        // Create gradient for bar
        const gradient = ctx.createLinearGradient(x, y, x, dimensions.height - dimensions.padding.bottom);
        const barColor = getBarColor(index, item);
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, `${barColor}CC`);

        // Draw bar
        ctx.fillStyle = isHovered ? barColor : gradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw value on top of bar
        if (showValues && progress === 1) {
          ctx.fillStyle = theme.palette.text.primary;
          ctx.font = 'bold 14px Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            item.value.toLocaleString(),
            x + barWidth / 2,
            y - 10
          );
        }

        // Draw X-axis labels
        ctx.fillStyle = theme.palette.text.secondary;
        ctx.font = '12px Roboto, sans-serif';
        ctx.textAlign = 'center';
        
        // Main label
        ctx.fillText(
          item.label,
          x + barWidth / 2,
          dimensions.height - dimensions.padding.bottom + 20
        );
        
        // Sub-label if exists
        if (item.subLabel) {
          ctx.font = '10px Roboto, sans-serif';
          ctx.fillStyle = theme.palette.text.disabled;
          ctx.fillText(
            item.subLabel,
            x + barWidth / 2,
            dimensions.height - dimensions.padding.bottom + 35
          );
        }
      });

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
  }, [data, dimensions, maxValue, theme, orientation, showValues, showGrid, animate, xLabel, yLabel, colorScheme]);

  // Handle mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const barWidth = dimensions.chartWidth / (data.length * 1.5);
    const barSpacing = barWidth * 0.5;

    // Find which bar is hovered
    let hoveredBar = -1;
    data.forEach((_, index) => {
      const barX = dimensions.padding.left + barSpacing + index * (barWidth + barSpacing);
      const barHeight = (data[index].value / maxValue) * dimensions.chartHeight;
      const barY = dimensions.height - dimensions.padding.bottom - barHeight;

      if (x >= barX && x <= barX + barWidth && y >= barY && y <= dimensions.height - dimensions.padding.bottom) {
        hoveredBar = index;
      }
    });

    if (hoveredBar !== hoverRef.current) {
      hoverRef.current = hoveredBar;
      // Trigger redraw
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Simple redraw without animation
        const event = new Event('redraw');
        canvas.dispatchEvent(event);
      }
    }

    canvas.style.cursor = hoveredBar >= 0 ? 'pointer' : 'default';
  };

  const handleMouseLeave = () => {
    hoverRef.current = -1;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
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
          style={{ display: 'block' }}
        />
      </Box>
    </Paper>
  );
};

export default EnterpriseBarChart;