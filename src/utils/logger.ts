import winston from 'winston'

const { combine, timestamp, printf, colorize, errors } = winston.format

const logFormat = printf(({ level, message, timestamp, stack, component }) => {
  const comp = component ? `[${component}]` : ''
  return `${timestamp} ${level} ${comp}: ${stack || message}`
})

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
})

export const createComponentLogger = (component: string) => {
  return logger.child({ component })
}
