import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom não tem IntersectionObserver — polyfill no-op (Reveal, animações on-scroll).
class IOStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
vi.stubGlobal('IntersectionObserver', IOStub)

// jsdom não tem ResizeObserver — polyfill no-op (medições de layout).
class ROStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ROStub)

// jsdom não implementa scrollTo.
vi.stubGlobal('scrollTo', () => {})
