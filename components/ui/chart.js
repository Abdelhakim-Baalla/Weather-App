export class Chart {
  constructor(ctx, config) {
    this.ctx = ctx
    this.config = config
    return new window.Chart(ctx, config)
  }
}

export const ChartContainer = () => {
  return null
}

export const ChartTooltip = () => {
  return null
}

export const ChartTooltipContent = () => {
  return null
}

export const ChartLegend = () => {
  return null
}

export const ChartLegendContent = () => {
  return null
}

export const ChartStyle = () => {
  return null
}
