interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isVerbose = process.env.VERBOSE_LOGGING === 'true';

// Only show errors and warnings in production, unless VERBOSE_LOGGING is enabled
const logger: Logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDevelopment || isVerbose) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (isDevelopment || isVerbose) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

export default logger; 