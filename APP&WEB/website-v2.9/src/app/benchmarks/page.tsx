import type { Metadata } from 'next';
import BenchmarkMatrix from '@/components/BenchmarkMatrix';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `GPU Benchmarks | Benchmark výsledky · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Ekam Deeksha GPU benchmark results across 8 GPUs — GTX 1060 to H100 SXM. TPB tuning, work-count sweeps, cost efficiency analysis. Výsledky GPU benchmarků algoritmu Ekam Deeksha.',
};

export default function BenchmarksPage() {
  return <BenchmarkMatrix />;
}
