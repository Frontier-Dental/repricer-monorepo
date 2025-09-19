export async function asyncFilter<T>(
  array: T[],
  callback: (item: T) => Promise<boolean>,
) {
  const results = await Promise.all(array.map(callback));
  return array.filter((_, index) => results[index]);
}
