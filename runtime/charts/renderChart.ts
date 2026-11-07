import { chartCategoryColor } from './chartColors.ts';
import {
  create,
  scaleBand,
  scaleLinear,
  scalePoint,
  axisBottom,
  axisLeft,
  line,
  area,
  pie,
  arc,
  format,
} from './d3.ts';
import type { ChartSettings, ChartPoint } from '@reportstudio/mini-reports';

let gradientSequence = 0;

type Messages = { empty: string; pie: string };
/** One D3 SVG renderer for the designer, chart editor and PDF rasterization. */
export function renderChart(
  settings: ChartSettings,
  points: ChartPoint[],
  width = 800,
  height = 480,
  messages: Messages = {
    empty: 'No chart data. Select a table and fields.',
    pie: 'Pie charts require positive values.',
  },
): SVGSVGElement {
  const svg = create('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('font-family', 'Arial, Helvetica, sans-serif')
    .attr('font-size', 12)
    .attr('color', '#334155');
  svg.append('rect').attr('width', width).attr('height', height).attr('fill', settings.background);
  if (settings.title)
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0f172a')
      .attr('font-size', 18)
      .attr('font-weight', 600)
      .text(settings.title);
  const radial = settings.kind === 'pie' || settings.kind === 'donut';
  const data = radial ? points.filter((point) => point.value > 0) : points;
  if (!data.length) {
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#64748b')
      .text(points.length && radial ? messages.pie : messages.empty);
    return svg.node()!;
  }
  const number = format(',.3~s');
  const pointColor = (point: ChartPoint, index: number) =>
    chartCategoryColor(settings, point.label, index);
  const customColors = Object.keys(settings.categoryColors ?? {}).length > 0;
  if (radial) {
    const right = settings.showLegend ? Math.min(220, width * 0.3) : 0;
    const radius = Math.max(10, Math.min(width - right - 40, height - 70) / 2);
    const center = svg
      .append('g')
      .attr('transform', `translate(${(width - right) / 2},${(height + 30) / 2})`);
    // The arc data type is inferred separately to keep geometry and values together.
    const slices = pie<ChartPoint>()
      .sort(null)
      .value((point) => point.value)(data);
    const path = arc<(typeof slices)[number]>()
      .innerRadius(settings.kind === 'donut' ? radius * 0.58 : 0)
      .outerRadius(radius);
    center
      .selectAll('path')
      .data(slices)
      .join('path')
      .attr('d', path)
      .attr('fill', (slice, index) => pointColor(slice.data, index))
      .attr('stroke', settings.background)
      .attr('stroke-width', 2)
      .append('title')
      .text((slice) => `${slice.data.label}: ${slice.data.value}`);
    if (settings.showLabels)
      center
        .selectAll('text')
        .data(slices.filter((slice) => slice.endAngle - slice.startAngle > 0.18))
        .join('text')
        .attr('transform', (slice) => `translate(${path.centroid(slice)})`)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0f172a')
        .attr('font-weight', 600)
        .text((slice) => number(slice.data.value));
    if (settings.showLegend) {
      const legend = svg.append('g').attr('transform', `translate(${width - right},55)`);
      data.slice(0, Math.max(1, Math.floor((height - 65) / 22))).forEach((point, index) => {
        legend
          .append('rect')
          .attr('x', 0)
          .attr('y', index * 22)
          .attr('width', 10)
          .attr('height', 10)
          .attr('fill', pointColor(point, index));
        legend
          .append('text')
          .attr('x', 16)
          .attr('y', index * 22 + 10)
          .attr('fill', '#334155')
          .text(point.label.slice(0, 23))
          .append('title')
          .text(point.label);
      });
    }
    return svg.node()!;
  }
  const left = settings.kind === 'bar' ? 130 : 70,
    right = 25,
    top = settings.title ? 50 : 25,
    bottom = height - (settings.showLegend ? 68 : 48);
  const min = Math.min(0, ...data.map((point) => point.value)),
    max = Math.max(0, ...data.map((point) => point.value));
  const horizontal = settings.kind === 'bar';
  const numeric = scaleLinear()
    .domain(min === max ? [0, 1] : [min, max])
    .nice()
    .range(horizontal ? [left, width - right] : [bottom, top]);
  const categories = scaleBand<string>()
    .domain(data.map((point) => point.label))
    .range(horizontal ? [top, bottom] : [left, width - right])
    .padding(0.22);
  const pointsX = scalePoint<string>()
    .domain(data.map((point) => point.label))
    .range([left + 10, width - right - 10])
    .padding(0.3);
  if (settings.showGrid) {
    const grid = horizontal
      ? axisBottom(numeric)
          .ticks(6)
          .tickSize(-(bottom - top))
      : axisLeft(numeric)
          .ticks(5)
          .tickSize(-(width - left - right));
    svg
      .append('g')
      .attr('transform', horizontal ? `translate(0,${bottom})` : `translate(${left},0)`)
      .call(grid)
      .call((group) => group.select('.domain').remove())
      .call((group) => group.selectAll('text').remove())
      .call((group) => group.selectAll('line').attr('stroke', '#e2e8f0'));
  }
  const labels = data
    .filter((_, index) => index % Math.max(1, Math.ceil(data.length / 10)) === 0)
    .map((point) => point.label);
  const xAxis = horizontal
    ? axisBottom(numeric)
        .ticks(6)
        .tickFormat((value) => number(Number(value)))
    : axisBottom(settings.kind === 'line' || settings.kind === 'area' ? pointsX : categories)
        .tickValues(labels)
        .tickFormat((value) => String(value).slice(0, 14));
  const yAxis = horizontal
    ? axisLeft(categories)
        .tickValues(labels)
        .tickFormat((value) => String(value).slice(0, 18))
    : axisLeft(numeric)
        .ticks(5)
        .tickFormat((value) => number(Number(value)));
  svg.append('g').attr('transform', `translate(0,${bottom})`).call(xAxis);
  svg.append('g').attr('transform', `translate(${left},0)`).call(yAxis);
  if (settings.kind === 'line' || settings.kind === 'area') {
    let seriesColor = settings.color;
    if (customColors) {
      const id = `chart-gradient-${++gradientSequence}`;
      const gradient = svg
        .append('defs')
        .append('linearGradient')
        .attr('id', id)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', pointsX(data[0].label)!)
        .attr('x2', pointsX(data.at(-1)!.label)!)
        .attr('y1', 0)
        .attr('y2', 0);
      gradient
        .selectAll('stop')
        .data(data)
        .join('stop')
        .attr('offset', (_, index) => `${(100 * index) / Math.max(1, data.length - 1)}%`)
        .attr('stop-color', pointColor);
      seriesColor = `url(#${id})`;
    }
    if (settings.kind === 'area')
      svg
        .append('path')
        .datum(data)
        .attr('fill', seriesColor)
        .attr('fill-opacity', 0.2)
        .attr(
          'd',
          area<ChartPoint>()
            .x((point) => pointsX(point.label)!)
            .y0(numeric(0))
            .y1((point) => numeric(point.value)),
        );
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', seriesColor)
      .attr('stroke-width', 3)
      .attr(
        'd',
        line<ChartPoint>()
          .x((point) => pointsX(point.label)!)
          .y((point) => numeric(point.value)),
      );
    svg
      .selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', (point) => pointsX(point.label)!)
      .attr('cy', (point) => numeric(point.value))
      .attr('r', 4)
      .attr('fill', pointColor)
      .append('title')
      .text((point) => `${point.label}: ${point.value}`);
  } else {
    svg
      .selectAll('.chart-bar')
      .data(data)
      .join('rect')
      .attr('class', 'chart-bar')
      .attr('x', (point) =>
        horizontal ? Math.min(numeric(0), numeric(point.value)) : categories(point.label)!,
      )
      .attr('y', (point) =>
        horizontal ? categories(point.label)! : Math.min(numeric(0), numeric(point.value)),
      )
      .attr('width', (point) =>
        horizontal ? Math.abs(numeric(point.value) - numeric(0)) : categories.bandwidth(),
      )
      .attr('height', (point) =>
        horizontal ? categories.bandwidth() : Math.abs(numeric(point.value) - numeric(0)),
      )
      .attr('fill', pointColor)
      .append('title')
      .text((point) => `${point.label}: ${point.value}`);
  }
  if (settings.showLabels)
    svg
      .append('g')
      .selectAll('text')
      .data(data)
      .join('text')
      .attr('x', (point) =>
        horizontal
          ? numeric(point.value) + (point.value >= 0 ? 5 : -5)
          : settings.kind === 'line' || settings.kind === 'area'
            ? pointsX(point.label)!
            : categories(point.label)! + categories.bandwidth() / 2,
      )
      .attr('y', (point) =>
        horizontal
          ? categories(point.label)! + categories.bandwidth() / 2 + 4
          : numeric(point.value) + (point.value >= 0 ? -7 : 15),
      )
      .attr('text-anchor', (point) =>
        horizontal ? (point.value >= 0 ? 'start' : 'end') : 'middle',
      )
      .attr('fill', '#0f172a')
      .text((point) => number(point.value));
  if (settings.showLegend) {
    const items = customColors
      ? data.slice(0, Math.max(1, Math.floor((width - left - right) / 125)))
      : [{ label: settings.value || settings.category, value: 0 }];
    items.forEach((point, index) => {
      const x = left + index * 125;
      svg
        .append('rect')
        .attr('x', x)
        .attr('y', height - 20)
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', customColors ? pointColor(point, index) : settings.color);
      svg
        .append('text')
        .attr('x', x + 16)
        .attr('y', height - 10)
        .attr('fill', '#334155')
        .text(point.label.slice(0, 14))
        .append('title')
        .text(point.label);
    });
  }
  svg.selectAll('text').attr('font-family', 'Arial, Helvetica, sans-serif');
  return svg.node()!;
}

export async function chartPng(
  settings: ChartSettings,
  points: ChartPoint[],
  width: number,
  height: number,
): Promise<string> {
  const svg = renderChart(settings, points, 800, (800 * height) / width);
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render chart.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
