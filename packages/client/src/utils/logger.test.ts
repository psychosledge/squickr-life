import { describe, it, expect, vi, beforeEach, afterEach, type SpyInstance } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let consoleLogSpy: SpyInstance;
  let consoleWarnSpy: SpyInstance;
  let consoleErrorSpy: SpyInstance;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset to default config
    logger.configure({ level: 'debug', enabled: true });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('debug', () => {
    it('should log debug messages when level is debug', () => {
      logger.configure({ level: 'debug' });
      logger.debug('[Test]', 'Debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Test]', 'Debug message');
    });

    it('should not log debug messages when level is info', () => {
      logger.configure({ level: 'info' });
      logger.debug('[Test]', 'Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info messages when level is info', () => {
      logger.configure({ level: 'info' });
      logger.info('[Test]', 'Info message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Test]', 'Info message');
    });

    it('should not log info messages when level is warn', () => {
      logger.configure({ level: 'warn' });
      logger.info('[Test]', 'Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('warn', () => {
    it('should log warn messages when level is warn', () => {
      logger.configure({ level: 'warn' });
      logger.warn('[Test]', 'Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Test]', 'Warning message');
    });

    it('should not log warn messages when level is error', () => {
      logger.configure({ level: 'error' });
      logger.warn('[Test]', 'Warning message');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('should log error messages when level is error', () => {
      logger.configure({ level: 'error' });
      logger.error('[Test]', 'Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test]', 'Error message');
    });

    it('should not log error messages when level is silent', () => {
      logger.configure({ level: 'silent' });
      logger.error('[Test]', 'Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log error messages with error objects', () => {
      logger.configure({ level: 'error' });
      const error = new Error('Test error');
      logger.error('[Test]', 'Error occurred:', error);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test]', 'Error occurred:', error);
    });
  });

  describe('configure', () => {
    it('should allow disabling logging entirely', () => {
      logger.configure({ enabled: false });
      logger.error('[Test]', 'Should not appear');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should allow changing log level', () => {
      logger.configure({ level: 'warn' });
      logger.info('[Test]', 'Info');
      logger.warn('[Test]', 'Warning');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('log level hierarchy', () => {
    it('should respect level hierarchy: debug < info < warn < error < silent', () => {
      logger.configure({ level: 'warn' });
      
      logger.debug('[Test]', 'Debug');
      logger.info('[Test]', 'Info');
      logger.warn('[Test]', 'Warning');
      logger.error('[Test]', 'Error');
      
      expect(consoleLogSpy).not.toHaveBeenCalled(); // debug and info blocked
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // warn allowed
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error allowed
    });
  });
});
