export interface TestQueue { obliterate: (options: { force: boolean }) => Promise<void>; }

export async function drainQueue(queue: TestQueue): Promise<void> { await queue.obliterate({ force: true }); }
