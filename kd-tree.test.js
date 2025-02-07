const KDTree = require("./kd-tree"); //This is the tree we're testing

//groups all tests related to the KD Tree
describe("KDTree Normal Case", () => {
  let points;

  //runs before each test -- setting up points to be tested
  beforeEach(() => {
    points = [
      [30, 20, 10],
      [60, 50, 40],
      [10, 5, 0],
      [90, 80, 70],
      [45, 35, 25],
    ];
  });

  test("constructs a valid KDTree", () => {
    const tree = new KDTree(points);

    //make sure tree is set up correctly
    expect(tree.point).toBeDefined(); //root node should be defined

    //each subtree should be another KDTree (because recursion)
    expect(tree.left).toBeInstanceOf(KDTree);
    expect(tree.right).toBeInstanceOf(KDTree);

    expect(tree.left.point).toBeDefined();
    expect(tree.right.point).toBeDefined();

    expect(tree.axis).toBe(0);
    expect(tree.left.axis).toBe(1);
    expect(tree.right.axis).toBe(1);

    //making sure inner callback function (inside Array.sort()) computes correctly
    const sortedPoints = points
      .slice()
      .sort((a, b) => a[tree.axis] - b[tree.axis]);

    expect(sortedPoints[2]).toEqual(tree.point);
  });

  //covers all forseeable cases
  test("calculateDistance returns correct Euclidean distance", () => {
    const tree = new KDTree();
    const distance = tree.calculateDistance([3, 4, 5], [6, 8, 10]);
    expect(distance).toBeCloseTo(Math.sqrt(50));
    expect(tree.calculateDistance([10, 20, 30], [10, 20, 30])).toBe(0);
  });

  test("findNearestNeighbor returns closest value", () => {
    //it's assumed we have a valid target point
    const tree = new KDTree(points);
    const nearest = tree.findNearestNeighbor([47, 37, 27]);
    expect(nearest.point).toEqual([45, 35, 25]);
  });
});

describe("KDTree Edge Cases", () => {
  test("handles empty input array", () => {
    const tree = new KDTree([]);
    expect(tree.point).toBeNull(); // No root should exist
    expect(tree.left).toBeNull();
    expect(tree.right).toBeNull();
  });

  test("handles single-point input", () => {
    const singlePoint = [[25, 25, 25]];
    const tree = new KDTree(singlePoint);

    expect(tree.point).toEqual([25, 25, 25]);
    expect(tree.left).toBeNull();
    expect(tree.right).toBeNull();
  });

  test("handles duplicate points", () => {
    const duplicatePoints = [
      [30, 30, 30],
      [30, 30, 30],
      [30, 30, 30],
    ];
    const tree = new KDTree(duplicatePoints);

    expect(tree.point).toEqual([30, 30, 30]);
    expect(tree.left.left).toBeNull();
    expect(tree.left.right).toBeNull();
    expect(tree.right.left).toBeNull(); // All points are the same, no need for left/right
    expect(tree.right.right).toBeNull(); // All points are the same, no need for left/right
  });

  test("handles tree with all identical points", () => {
    const identicalPoints = [
      [50, 50, 50],
      [50, 50, 50],
      [50, 50, 50],
    ];
    const tree = new KDTree(identicalPoints);

    expect(tree.point).toEqual([50, 50, 50]);
    expect(tree.left.left).toBeNull();
    expect(tree.left.right).toBeNull();
    expect(tree.right.left).toBeNull(); // All points are the same, no need for left/right
    expect(tree.right.right).toBeNull(); // All points are the same, no need for left/right
  });

  test("findNearestNeighbor handles empty tree", () => {
    const tree = new KDTree([]);
    const target = [50, 50, 50];

    const nearest = tree.findNearestNeighbor(target);
    expect(nearest.point).toBeNull();
    expect(nearest.distance).toBe(Infinity);
  });

  test("findNearestNeighbor works for single-node tree", () => {
    const singlePoint = [[25, 25, 25]];
    const tree = new KDTree(singlePoint);
    const target = [30, 30, 30];

    const nearest = tree.findNearestNeighbor(target);
    expect(nearest.point).toEqual([25, 25, 25]);
  });
});

describe("KDTree Stress Tests & Performance", () => {
  let largePoints, clusteredPoints, gridPoints, sparsePoints;

  beforeEach(() => {
    // Generate 10,000 random 3D points
    largePoints = Array.from({ length: 10000 }, () =>
      Array.from({ length: 3 }, () => Math.floor(Math.random() * 256))
    );

    // 10,000 points tightly clustered around (100, 100, 100)
    clusteredPoints = Array.from({ length: 10000 }, () => [
      100 + Math.floor(Math.random() * 5),
      100 + Math.floor(Math.random() * 5),
      100 + Math.floor(Math.random() * 5),
    ]);
    // 3D grid: 21x21x21 evenly spaced points
    gridPoints = [];
    for (let x = 0; x <= 200; x += 10) {
      for (let y = 0; y <= 200; y += 10) {
        for (let z = 0; z <= 200; z += 10) {
          gridPoints.push([x, y, z]);
        }
      }
    }

    // 10,000 points spread over a large range (sparse dataset)
    sparsePoints = Array.from({ length: 10000 }, () => [
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
      Math.floor(Math.random() * 100000),
    ]);
  });

  function logMemoryUsage(label) {
    const memoryUsage = process.memoryUsage();
    console.log(
      `${label} - Memory Usage: RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(
        2
      )} MB, Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
  }

  test("constructs KDTree with large dataset efficiently", () => {
    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const tree = new KDTree(largePoints);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(tree.point).toBeDefined(); // Ensure tree root is assigned
    expect(tree.left).toBeInstanceOf(KDTree);
    expect(tree.right).toBeInstanceOf(KDTree);

    console.log(
      `KDTree construction time: ${(endTime - startTime).toFixed(2)} ms`
    );
  });

  test("constructs KDTree with highly clustered points efficiently", () => {
    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const tree = new KDTree(clusteredPoints);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(tree.point).toBeDefined();
    console.log(
      `KDTree (clustered points) construction time: ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );
  });

  test("constructs KDTree with evenly spaced grid efficiently", () => {
    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const tree = new KDTree(gridPoints);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(tree.point).toBeDefined();
    console.log(
      `KDTree (grid points) construction time: ${(endTime - startTime).toFixed(
        2
      )} ms`
    );
  });

  test("constructs KDTree with sparse dataset efficiently", () => {
    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const tree = new KDTree(sparsePoints);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(tree.point).toBeDefined();
    console.log(
      `KDTree (sparse points) construction time: ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );
  });

  test("findNearestNeighbor performs efficiently with large dataset", () => {
    const tree = new KDTree(largePoints);
    const target = [128, 128, 128];

    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const nearest = tree.findNearestNeighbor(target);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(nearest.point).toBeDefined();
    console.log(
      `Nearest neighbor search time: ${(endTime - startTime).toFixed(2)} ms`
    );
  });

  test("findNearestNeighbor works efficiently with clustered points", () => {
    const tree = new KDTree(clusteredPoints);
    const target = [102, 102, 102];

    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const nearest = tree.findNearestNeighbor(target);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(nearest.point).toBeDefined();
    console.log(
      `Nearest neighbor (clustered points) search time: ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );
  });

  test("findNearestNeighbor works efficiently with grid points", () => {
    const tree = new KDTree(gridPoints);
    const target = [105, 105, 105];

    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const nearest = tree.findNearestNeighbor(target);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(nearest.point).toBeDefined();
    console.log(
      `Nearest neighbor (grid points) search time: ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );
  });

  test("findNearestNeighbor works efficiently with sparse dataset", () => {
    const tree = new KDTree(sparsePoints);
    const target = [50000, 50000, 50000];

    logMemoryUsage("Before construction (large dataset)");
    const startTime = performance.now();
    const nearest = tree.findNearestNeighbor(target);
    const endTime = performance.now();
    logMemoryUsage("After construction (large dataset)");

    expect(nearest.point).toBeDefined();
    console.log(
      `Nearest neighbor (sparse points) search time: ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );
  });
});
