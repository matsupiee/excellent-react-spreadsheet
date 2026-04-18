import type { Meta, StoryObj } from '@storybook/react';

function Welcome() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>excellent-react-spreadsheet</h1>
      <p>
        Visual catalog and benchmark harness. See <code>CLAUDE.md</code> for the development loop.
      </p>
    </div>
  );
}

const meta: Meta<typeof Welcome> = {
  title: 'Welcome',
  component: Welcome,
};

export default meta;

export const Default: StoryObj<typeof Welcome> = {};
