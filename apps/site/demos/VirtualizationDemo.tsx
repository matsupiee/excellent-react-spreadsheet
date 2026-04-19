import { useMemo, useRef, useState, type CSSProperties } from 'react';

import { useRowVirtualizer } from 'excellent-react-spreadsheet';

type Sample = {
  id: number;
  label: string;
  metric: number;
  hash: string;
};

const ROW_COUNT = 10_000;
const ROW_HEIGHT = 28;
const VIEWPORT_HEIGHT = 320;

const makeSample = (index: number): Sample => ({
  id: index,
  label: `row-${index.toString().padStart(5, '0')}`,
  metric: Math.round(Math.sin(index) * 500 + 500),
  hash: (index * 2654435761).toString(16).slice(-6),
});

const dataset: Sample[] = Array.from({ length: ROW_COUNT }, (_, i) => makeSample(i));

const scrollStyle: CSSProperties = {
  height: VIEWPORT_HEIGHT,
  overflow: 'auto',
  border: '1px solid var(--vp-c-divider, #d4d4d8)',
  borderRadius: 8,
  background: 'var(--vp-c-bg, #fff)',
  position: 'relative',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1fr 120px 100px',
  alignItems: 'center',
  height: ROW_HEIGHT,
  padding: '0 10px',
  borderBottom: '1px solid var(--vp-c-divider-light, #e4e4e7)',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
};

const headerStyle: CSSProperties = {
  ...rowStyle,
  fontWeight: 600,
  background: 'var(--vp-c-bg-soft, #f4f4f5)',
  position: 'sticky',
  top: 0,
};

export default function VirtualizationDemo() {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const virt = useRowVirtualizer({
    rowCount: ROW_COUNT,
    rowHeight: ROW_HEIGHT,
    viewportHeight: VIEWPORT_HEIGHT,
    scrollTop,
    overscan: 6,
  });

  const visible = useMemo(() => {
    const out: Sample[] = [];
    for (let i = virt.startIndex; i <= virt.endIndex; i += 1) {
      const row = dataset[i];
      if (row !== undefined) out.push(row);
    }
    return out;
  }, [virt.startIndex, virt.endIndex]);

  return (
    <div className="ers-demo-frame">
      <div className="ers-demo-toolbar">
        <span className="ers-demo-status">
          Rendering {visible.length} of {ROW_COUNT.toLocaleString()} rows · scrollTop{' '}
          {scrollTop.toLocaleString()} / {virt.totalHeight.toLocaleString()} px
        </span>
      </div>
      <div style={headerStyle}>
        <span>id</span>
        <span>label</span>
        <span style={{ textAlign: 'right' }}>metric</span>
        <span style={{ textAlign: 'right' }}>hash</span>
      </div>
      <div
        ref={scrollRef}
        style={scrollStyle}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: virt.totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${virt.paddingTop}px)` }}>
            {visible.map((row) => (
              <div key={row.id} style={rowStyle}>
                <span>{row.id}</span>
                <span>{row.label}</span>
                <span style={{ textAlign: 'right' }}>{row.metric}</span>
                <span style={{ textAlign: 'right' }}>{row.hash}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
