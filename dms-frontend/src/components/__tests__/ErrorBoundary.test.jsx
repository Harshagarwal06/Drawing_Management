import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function ThrowingChild() {
  throw new Error('Test crash');
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
    console.error.mockRestore();
  });
});
