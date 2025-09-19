declare module "execution-time" {
  export function start(name: string): void;
  export function stop(name: string): { time: number };
}
