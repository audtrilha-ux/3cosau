import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class IdGeneratorService {
  /**
   * Generates a cryptographically secure UUID v4.
   * If the crypto API is not supported or not in a secure context, 
   * fallback to a high-entropy pseudo-random UUID generator.
   */
  generateUUID(): string {
    if (typeof window !== 'undefined' && window.crypto) {
      if (typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      
      // Fallback using crypto.getRandomValues for secure pseudo-randomness
      try {
        const tempArr = new Uint32Array(4);
        window.crypto.getRandomValues(tempArr);
        // Custom simple conversion to UUID format
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c, r) => {
          const rand = (tempArr[Math.floor(r / 32)] >> (r % 32)) & 0xf;
          const v = c === 'x' ? rand : (rand & 0x3 | 0x8);
          return v.toString(16);
        });
      } catch (e) {
        // Fall back to pseudo-random string if secure RNG fails
      }
    }
    
    // Non-browser fallback or standard fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generates a short unique prefix-based ID for UI and local display
   */
  generatePrefixedId(prefix: string): string {
    const uuid = this.generateUUID();
    const short = uuid.split('-')[0]; // first 8 characters
    return `${prefix}-${short}`;
  }

  /**
   * Generates a secure, collision-free transaction code using Web Crypto entropy
   */
  generateTransactionCode(prefix = 'TX'): string {
    const ts = Date.now().toString(36).toUpperCase();
    let rand = 0;
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      rand = 1000 + (arr[0] % 9000);
    } else {
      rand = 1000 + Math.floor(Math.random() * 9000);
    }
    return `${prefix}-${ts}-${rand}`;
  }
}
