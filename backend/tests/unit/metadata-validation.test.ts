import { describe, it, expect } from 'vitest';
import { isGenericName, sanitizeProductName, sanitizeProductImage } from '../../src/services/domain/product/utils/metadata';

describe('Product Metadata Utilities', () => {
  describe('isGenericName', () => {
    it('should identify blacklisted names', () => {
      expect(isGenericName('Loading...')).toBe(true);
      expect(isGenericName('Enable Javascript')).toBe(true);
      expect(isGenericName('Checkout')).toBe(true);
      expect(isGenericName(null)).toBe(true);
    });

    it('should identify names containing blacklisted phrases', () => {
      expect(isGenericName('Your Cart is Empty')).toBe(true);
      expect(isGenericName('Notifications Red Dot')).toBe(true);
    });

    it('should allow valid names', () => {
      expect(isGenericName('Apple iPhone 15 Pro')).toBe(false);
      expect(isGenericName('Sony WH-1000XM5')).toBe(false);
    });
  });

  describe('sanitizeProductName', () => {
    it('should return null for generic names', () => {
      expect(sanitizeProductName('Loading...')).toBe(null);
    });

    it('should trim and truncate valid names', () => {
      const longName = 'A'.repeat(300);
      const sanitized = sanitizeProductName('  ' + longName + '  ');
      expect(sanitized).toHaveLength(255);
      expect(sanitized?.startsWith('A')).toBe(true);
    });
  });

  describe('sanitizeProductImage', () => {
    it('should return null for placeholder images', () => {
      expect(sanitizeProductImage('http://example.com/placeholder.png', null)).toBe(null);
    });

    it('should return the image URL if current is placeholder', () => {
      expect(sanitizeProductImage('http://example.com/real.jpg', 'placeholder.png')).toBe('http://example.com/real.jpg');
    });

    it('should return null if current image is already a real image', () => {
      expect(sanitizeProductImage('http://example.com/new.jpg', 'http://example.com/old.jpg')).toBe(null);
    });
  });
});
