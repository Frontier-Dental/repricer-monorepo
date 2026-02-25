import { asyncFilter } from "../arrays";

describe("arrays", () => {
  describe("asyncFilter", () => {
    it("should filter array based on async callback", async () => {
      const array = [1, 2, 3, 4, 5];
      const callback = async (item: number) => item % 2 === 0;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([2, 4]);
    });

    it("should return empty array when no items match", async () => {
      const array = [1, 3, 5];
      const callback = async (item: number) => item > 10;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([]);
    });

    it("should return all items when all match", async () => {
      const array = [1, 2, 3];
      const callback = async (item: number) => item > 0;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should handle empty array", async () => {
      const array: number[] = [];
      const callback = async (item: number) => item > 0;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([]);
    });

    it("should handle async operations in callback", async () => {
      const array = [1, 2, 3];
      const callback = async (item: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return item > 1;
      };

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([2, 3]);
    });

    it("should handle string arrays", async () => {
      const array = ["apple", "banana", "cherry"];
      const callback = async (item: string) => item.length > 5;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual(["banana", "cherry"]);
    });

    it("should handle object arrays", async () => {
      const array = [
        { id: 1, active: true },
        { id: 2, active: false },
        { id: 3, active: true },
      ];
      const callback = async (item: { id: number; active: boolean }) => item.active;

      const result = await asyncFilter(array, callback);
      expect(result).toEqual([
        { id: 1, active: true },
        { id: 3, active: true },
      ]);
    });
  });
});
