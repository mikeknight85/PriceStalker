import { load } from 'cheerio';
import { 
  parseSrcset, 
  extractAllImageAttributes, 
  processImageElement, 
  evaluateImageSelectors,
  parseImageDimensions
} from '../services/scraper/metadata/image';

function runTests() {
  let passed = true;
  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
    } else {
      console.error(`❌ [FAIL] ${message}`);
      passed = false;
    }
  };

  console.log('--- 1. Testing parseSrcset ---');
  const srcset1 = 'https://example.com/img1.jpg 300w, https://example.com/img2.jpg 600w';
  const candidates1 = parseSrcset(srcset1);
  assert(candidates1.length === 2, 'Should parse 2 candidates');
  assert(candidates1[0].url === 'https://example.com/img1.jpg', 'First candidate URL matches');
  assert(candidates1[0].width === 300, 'First candidate width matches 300w');
  assert(candidates1[1].width === 600, 'Second candidate width matches 600w');

  const srcset2 = 'https://example.com/img1.jpg 1x, https://example.com/img2.jpg 2x';
  const candidates2 = parseSrcset(srcset2);
  assert(candidates2.length === 2, 'Should parse 2 candidates');
  assert(candidates2[0].width === 1000, '1x factor scales to 1000');
  assert(candidates2[1].width === 2000, '2x factor scales to 2000');

  console.log('\n--- 2. Testing extractAllImageAttributes & processImageElement ---');
  const mockHtml = `
    <!DOCTYPE html>
    <html>
    <body>
      <picture class="hero-pic">
        <source srcset="https://example.com/hero-large.jpg 1200w, https://example.com/hero-xlarge.jpg 1600w" media="(min-width: 800px)">
        <source srcset="https://example.com/hero-small.jpg 400w" media="(max-width: 799px)">
        <img class="hero-img" src="https://example.com/hero-fallback.jpg?width=640&height=480" alt="Hero">
      </picture>

      <img class="gallery-img" src="https://example.com/gallery-thumb.jpg" data-srcset="https://example.com/gallery-300.jpg 300w, https://example.com/gallery-1000.jpg 1000w">
      <img class="lazy-img" src="https://example.com/placeholder.gif" data-lazy-src="https://example.com/lazy-original.jpg">
      <link rel="preload" as="image" href="https://example.com/preload-fallback.jpg" imagesrcset="https://example.com/preload-500.jpg 500w, https://example.com/preload-1500.jpg 1500w">
    </body>
    </html>
  `;
  const $ = load(mockHtml);

  // Test Case: Img with data-srcset
  const galleryImg = $('.gallery-img')[0];
  const galleryUrls: string[] = [];
  processImageElement(galleryImg, $, (url) => galleryUrls.push(url));
  assert(galleryUrls.includes('https://example.com/gallery-thumb.jpg'), 'Includes standard src');
  assert(galleryUrls.includes('https://example.com/gallery-300.jpg?width=300'), 'Includes srcset candidate with width param');
  assert(galleryUrls.includes('https://example.com/gallery-1000.jpg?width=1000'), 'Includes srcset candidate with width param');

  // Test Case: Img with data-lazy-src
  const lazyImg = $('.lazy-img')[0];
  const lazyUrls: string[] = [];
  processImageElement(lazyImg, $, (url) => lazyUrls.push(url));
  assert(lazyUrls.includes('https://example.com/lazy-original.jpg'), 'Extracts data-lazy-src');

  // Test Case: Picture tag source srcset
  const heroImg = $('.hero-img')[0];
  const heroUrls: string[] = [];
  processImageElement(heroImg, $, (url) => heroUrls.push(url));
  assert(heroUrls.includes('https://example.com/hero-fallback.jpg?width=640&height=480'), 'Includes fallback img src');
  assert(heroUrls.includes('https://example.com/hero-large.jpg?width=1200'), 'Includes source srcset candidate (1200w)');
  assert(heroUrls.includes('https://example.com/hero-xlarge.jpg?width=1600'), 'Includes source srcset candidate (1600w)');
  assert(heroUrls.includes('https://example.com/hero-small.jpg?width=400'), 'Includes source srcset candidate (400w)');

  // Test Case: Link preload with imagesrcset
  const preloadLink = $('link[rel="preload"]')[0];
  const preloadUrls: string[] = [];
  processImageElement(preloadLink, $, (url) => preloadUrls.push(url));
  assert(preloadUrls.includes('https://example.com/preload-fallback.jpg'), 'Includes link href');
  assert(preloadUrls.includes('https://example.com/preload-1500.jpg?width=1500'), 'Includes imagesrcset candidate (1500w)');

  console.log('\n--- 3. Testing evaluateImageSelectors (Picture Resolution) ---');
  const siteSelectors = ['.hero-img'];
  const candidates = evaluateImageSelectors($, siteSelectors, [], []);
  assert(candidates.length > 0, 'Should find candidates from selectors');
  
  // Find largest candidate
  let bestCandidate = candidates[0];
  let maxArea = 0;
  candidates.forEach(c => {
    const dims = parseImageDimensions(c.value);
    const area = dims ? dims.area : 0;
    if (area > maxArea) {
      maxArea = area;
      bestCandidate = c;
    }
  });
  console.log('Hero candidates found:', candidates.map(c => c.value));
  console.log('Highest resolution resolved URL:', bestCandidate.value);
  assert(bestCandidate.value.includes('hero-xlarge.jpg'), 'Should resolve to hero-xlarge.jpg (1600w)');

  console.log('\n--- 4. Testing evaluateImageSelectors (Lazy-Load Original) ---');
  const lazySelectors = ['.lazy-img'];
  const lazyCandidates = evaluateImageSelectors($, lazySelectors, [], []);
  
  // Find candidates that aren't placeholders
  const cleanLazyCandidates = lazyCandidates.filter(c => !c.value.includes('placeholder.gif'));
  console.log('Lazy candidates found (non-placeholder):', cleanLazyCandidates.map(c => c.value));
  assert(cleanLazyCandidates.length === 1, 'Should find 1 non-placeholder lazy candidate');
  assert(cleanLazyCandidates[0].value === 'https://example.com/lazy-original.jpg', 'Lazy candidate is lazy-original.jpg');

  if (passed) {
    console.log('\n🌟 ALL TESTS PASSED SUCCESSFULLY! 🌟');
  } else {
    console.error('\n❌ SOME TESTS FAILED! ❌');
    process.exit(1);
  }
}

runTests();
