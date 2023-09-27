module.exports = class WorkerQueue {
  constructor(task, concurrency = 5) {
    this.jobs = [];
    this.results = [];
    this.task = task;
    this.running = [];
    this.concurrency = concurrency;
  }

  enqueue(...args) {
    this.jobs.push(args);
    this.run();
  }

  run() {
    if (!this.jobs.length || this.running.length >= this.concurrency) return;
    do {
      const job = this.jobs.shift()
      const promise = this.task(...job);
      this.running.push(promise);
      promise.then(result => {
        this.results.push(result);
        this.running.splice(this.running.indexOf(promise), 1);
        this.run();
      });
    } while (this.running.length < this.concurrency && this.jobs.length);
  }

  finished() {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.running.length || this.jobs.length) return;
        clearInterval(interval);
        resolve();
      }, 100);
    });
  }
}