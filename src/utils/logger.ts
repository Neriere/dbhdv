export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  scope?: string;
  message: string;
  details?: unknown;
}

const MAX_LOG_ENTRIES = 100;
const STORAGE_KEY = "dbhdv_recent_errors";

class Logger {
  private entries: LogEntry[] = [];
  private scope?: string;

  constructor(scope?: string) {
    this.scope = scope;
  }

  public forScope(scope: string): Logger {
    return new Logger(scope);
  }

  private log(level: LogLevel, message: string, details?: unknown) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      scope: this.scope,
      message,
      details,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.shift();
    }

    // Persist critical errors to localStorage for troubleshooting
    if (level === "error" && typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed: LogEntry[] = stored ? JSON.parse(stored) : [];
        parsed.push(entry);
        if (parsed.length > 25) {
          parsed.shift();
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {
        // Storage quota exceeded or disabled; silently continue
      }
    }

    const prefix = this.scope ? `[${this.scope}]` : "[DBHDV]";
    const formatted = `${prefix} ${message}`;

    switch (level) {
      case "debug":
        if (process.env.NODE_ENV !== "production") {
          console.debug(formatted, details ?? "");
        }
        break;
      case "info":
        console.info(formatted, details ?? "");
        break;
      case "warn":
        console.warn(formatted, details ?? "");
        break;
      case "error":
        console.error(formatted, details ?? "");
        break;
    }
  }

  public debug(message: string, details?: unknown) {
    this.log("debug", message, details);
  }

  public info(message: string, details?: unknown) {
    this.log("info", message, details);
  }

  public warn(message: string, details?: unknown) {
    this.log("warn", message, details);
  }

  public error(message: string, details?: unknown) {
    this.log("error", message, details);
  }

  public getRecentLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.entries];
    return this.entries.filter((e) => e.level === level);
  }

  public getStoredErrors(): LogEntry[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public clearLogs(): void {
    this.entries = [];
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }
}

export const logger = new Logger();
export default logger;
