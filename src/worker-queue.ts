export class WorkerQueue<A extends unknown[], R> {
  private jobs: A[] = [] as unknown as A[];

  public results: R[] = [];

  private running: Promise<R>[] = [];

  constructor(
    private task: (...args: A) => Promise<R>,
    private concurrency = 5
  ) {
    this.task = task;
    this.concurrency = concurrency;
  }

  get Queued() {
    return this.jobs.length;
  }
  get Running() {
    return this.running.length;
  }

  enqueue(...args: A) {
    this.jobs.push(args);
    this.run();
  }

  run() {
    if (!this.jobs.length || this.running.length >= this.concurrency) return;
    do {
      const job = this.jobs.shift() as A;
      const promise = this.task(...job);
      this.running.push(promise);
      promise.then(
        (result) => {
          this.results.push(result);
          this.running.splice(this.running.indexOf(promise), 1);
          this.run();
        },
        () => {}
      );
    } while (this.running.length < this.concurrency && this.jobs.length);
  }

  finished() {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (this.running.length || this.jobs.length) return;
        clearInterval(interval);
        resolve();
      }, 100);
    });
  }
}

