import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';

interface PieSegment {
  label: string;
  value: number;
  color?: string;
  percentage?: number;
}

interface EnterprisePieChartProps {
  data: PieSegment[];
  title?: string;
  height?: number;
  width?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
  donut?: boolean;
  animate?: boolean;
  interactive?: boolean;
}

/**
 * Enterprise-grade Pie/Donut Chart Component
 * Canvas-based for optimal performance
 */
const EnterprisePieChart: React.FC<EnterprisePieChartProps> = ({
  data,
  title,
  height = 400,
  width,
  showLegend = true,
  showPercentages = true,
  donut = false,
  animate = true,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const animationRef = useRef<number>();
  const [hoveredSegment, setHoveredSegment] = useState<number>(-1);
  const [selectedSegment, setSelectedSegment] = useState<number>(-1);

  // Calculate dimensions
  const dimensions = useMemo(() => {
    const actualWidth = width || containerRef.current?.offsetWidth || 800;
    const legendWidth = showLegend ? 200 : 0;
    const chartSize = Math.min(actualWidth - legendWidth - 40, height - 80);
    
    return {
      width: actualWidth,
      height,
      chartSize,
      centerX: (actualWidth - legendWidth) / 2,
      centerY: height / 2,
      radius: chartSize / 2 - 20,
      innerRadius: donut ? chartSize / 4 : 0,
      legendX: actualWidth - legendWidth + 20,
      legendY: 60,
    };
  }, [width, height, showLegend, donut]);

  // Process data with percentages
  const processedData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return data.map((item, index) => ({
      ...item,
      percentage: (item.value / total) * 100,
      color: item.color || (theme.palette as any)[
        ['primary', 'secondary', 'success', 'warning', 'info', 'error'][index % 6]
      ].main,
    }));
  }, [data, theme]);

  // Calculate angles for each segment
  const angles = useMemo(() => {
    let currentAngle = -Math.PI / 2; // Start from top
    return processedData.map(item => {
      const startAngle = currentAngle;
      const endAngle = currentAngle + (item.percentage / 100) * Math.PI * 2;
      currentAngle = endAngle;
      return { startAngle, endAngle };
    });
  }, [processedData]);

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

      // Calculate animation progress
      if (animate) {
        const elapsed = Date.now() - startTime;
        progress = Math.min(elapsed / animationDuration, 1);
        // Easing function
        progress = 1 - Math.pow(1 - progress, 3);
      } else {
        progress = 1;
      }

      // Draw pie segments
      processedData.forEach((segment, index) => {
        const { startAngle, endAngle } = angles[index];
        const animatedEndAngle = startAngle + (endAngle - startAngle) * progress;
        const isHovered = hoveredSegment === index;
        const isSelected = selectedSegment === index;
        const offset = (isHovered || isSelected) ? 10 : 0;

        // Calculate offset position
        const midAngle = (startAngle + animatedEndAngle) / 2;
        const offsetX = Math.cos(midAngle) * offset;
        const offsetY = Math.sin(midAngle) * offset;

        // Draw shadow for hovered/selected segments
        if (isHovered || isSelected) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 5;
          ctx.shadowOffsetY = 5;
        }

        // Draw segment
        ctx.fillStyle = segment.color!;
        ctx.beginPath();
        ctx.arc(
          dimensions.centerX + offsetX,
          dimensions.centerY + offsetY,
          dimensions.radius,
          startAngle,
          animatedEndAngle
        );
        
        if (donut) {
          ctx.arc(
            dimensions.centerX + offsetX,
            dimensions.centerY + offsetY,
            dimensions.innerRadius,
            animatedEndAngle,
            startAngle,
            true
          );
        } else {
          ctx.lineTo(dimensions.centerX + offsetX, dimensions.centerY + offsetY);
        }
        
        ctx.closePath();
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw segment border
        ctx.strokeStyle = theme.palette.background.paper;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw percentage labels
        if (showPercentages && progress === 1 && segment.percentage > 5) {
          const labelAngle = (startAngle + endAngle) / 2;
          const labelRadius = donut ? 
            (dimensions.radius + dimensions.innerRadius) / 2 : 
            dimensions.radius * 0.7;
          
          const labelX = dimensions.centerX + Math.cos(labelAngle) * labelRadius + offsetX;
          const labelY = dimensions.centerY + Math.sin(labelAngle) * labelRadius + offsetY;

          ctx.fillStyle = theme.palette.getContrastText(segment.color!);
          ctx.font = 'bold 14px Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${segment.percentage.toFixed(1)}%`, labelX, labelY);
        }
      });

      // Draw center circle for donut chart
      if (donut) {
        ctx.fillStyle = theme.palette.background.paper;
        ctx.beginPath();
        ctx.arc(dimensions.centerX, dimensions.centerY, dimensions.innerRadius - 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw center text
        if (selectedSegment >= 0) {
          const selected = processedData[selectedSegment];
          ctx.fillStyle = theme.palette.text.primary;
          ctx.font = 'bold 20px Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(selected.value.toLocaleString(), dimensions.centerX, dimensions.centerY - 10);
          
          ctx.font = '14px Roboto, sans-serif';
          ctx.fillStyle = theme.palette.text.secondary;
          ctx.fillText(selected.label, dimensions.centerX, dimensions.centerY + 15);
        } else {
          // Show total
          const total = data.reduce((sum, item) => sum + item.value, 0);
          ctx.fillStyle = theme.palette.text.primary;
          ctx.font = 'bold 24px Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(total.toLocaleString(), dimensions.centerX, dimensions.centerY - 10);
          
          ctx.font = '14px Roboto, sans-serif';
          ctx.fillStyle = theme.palette.text.secondary;
          ctx.fillText('Total', dimensions.centerX, dimensions.centerY + 15);
        }
      }

      // Draw legend
      if (showLegend && progress === 1) {
        let legendY = dimensions.legendY;
        
        processedData.forEach((segment, index) => {
          const isHovered = hoveredSegment === index;
          const isSelected = selectedSegment === index;

          // Legend item background
          if (isHovered || isSelected) {
            ctx.fillStyle = theme.palette.action.hover;
            ctx.fillRect(dimensions.legendX - 10, legendY - 15, 180, 30);
          }

          // Color box
          ctx.fillStyle = segment.color!;
          ctx.fillRect(dimensions.legendX, legendY - 10, 20, 20);
          
          // Legend text
          ctx.fillStyle = theme.palette.text.primary;
          ctx.font = isSelected ? 'bold 14px Roboto, sans-serif' : '14px Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(segment.label, dimensions.legendX + 30, legendY);
          
          // Value
          ctx.fillStyle = theme.palette.text.secondary;
          ctx.font = '12px Roboto, sans-serif';
          ctx.fillText(
            `${segment.value.toLocaleString()} (${segment.percentage.toFixed(1)}%)`,
            dimensions.legendX + 30,
            legendY + 15
          );
          
          legendY += 40;
        });
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
  }, [
    data,
    processedData,
    angles,
    dimensions,
    theme,
    showLegend,
    showPercentages,
    donut,
    animate,
    hoveredSegment,
    selectedSegment,
  ]);

  // Handle mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is over pie chart
    const dx = x - dimensions.centerX;
    const dy = y - dimensions.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= dimensions.radius && (!donut || distance >= dimensions.innerRadius)) {
      // Find which segment
      const angle = Math.atan2(dy, dx);
      const normalizedAngle = angle < -Math.PI / 2 ? angle + Math.PI * 2 : angle;

      let hoveredIndex = -1;
      angles.forEach((segmentAngles, index) => {
        const start = segmentAngles.startAngle < -Math.PI / 2 ? 
          segmentAngles.startAngle + Math.PI * 2 : segmentAngles.startAngle;
        const end = segmentAngles.endAngle < -Math.PI / 2 ? 
          segmentAngles.endAngle + Math.PI * 2 : segmentAngles.endAngle;

        if (normalizedAngle >= start && normalizedAngle <= end) {
          hoveredIndex = index;
        }
      });

      setHoveredSegment(hoveredIndex);
      canvasRef.current.style.cursor = hoveredIndex >= 0 ? 'pointer' : 'default';
    } else if (showLegend && x >= dimensions.legendX - 10) {
      // Check legend hover
      const legendIndex = Math.floor((y - dimensions.legendY + 15) / 40);
      if (legendIndex >= 0 && legendIndex < processedData.length) {
        setHoveredSegment(legendIndex);
        canvasRef.current.style.cursor = 'pointer';
      } else {
        setHoveredSegment(-1);
        canvasRef.current.style.cursor = 'default';
      }
    } else {
      setHoveredSegment(-1);
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleMouseLeave = () => {
    setHoveredSegment(-1);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || hoveredSegment < 0) return;
    
    setSelectedSegment(hoveredSegment === selectedSegment ? -1 : hoveredSegment);
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
          onClick={handleClick}
          style={{ display: 'block' }}
        />
      </Box>
    </Paper>
  );
};

export default EnterprisePieChart;