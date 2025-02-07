class KDTree {
  //points -- coordinate points -- each point is a pixel
  //depth -- current level in the tree
  //k -- number of dimensions
  constructor(points = [], level = 0) {
    this.axis = level % 3; //R=0, G=1, B=2

    //base case -- exit algorithm when there are no more points to process
    if (points.length === 0) {
      this.point = null; //current point
      this.left = null; //left side of current point
      this.right = null; //right side of current point
      return;
    }

    if (points.length === 1) {
      this.point = points[0];
      this.axis = level % 3;
      this.left = null; // ✅ Prevents unnecessary empty tree creation
      this.right = null;
      return;
    }

    //tree needs pre-sorted array
    points.sort((a, b) => a[this.axis] - b[this.axis]); //sort points per axis
    const midpoint = Math.floor(points.length / 2);

    //currently, points[] is a matrix sorted by the current axis | this.axis starts at 0 (X-axis)
    this.point = points[midpoint];
    this.left = new KDTree(points.slice(0, midpoint), level + 1); //grabbing all elements for left child node
    this.right = new KDTree(points.slice(midpoint + 1), level + 1); //grabbing all elements for right child node
  }

  calculateDistance(point1, point2) {
    const deltaX = (point1[0] - point2[0]) ** 2;
    const deltaY = (point1[1] - point2[1]) ** 2;
    const deltaZ = (point1[2] - point2[2]) ** 2;
    return Math.sqrt(deltaX + deltaY + deltaZ);
  }

  findNearestNeighbor(
    targetPoint,
    level = 0,
    bestMatch = { point: null, distance: Infinity }
  ) {
    if (!this.point) {
      // console.log("FINAL Best Match: ", bestMatch.point)
      return bestMatch;
    }
    const axis = level % 3;
    const distance = this.calculateDistance(targetPoint, this.point);

    //update best match if current point is closer
    if (distance < bestMatch.distance) {
      // console.log("NEW Best Match: ", bestMatch.point)
      bestMatch = { point: this.point, distance };
    }

    const direction = targetPoint[axis] < this.point[axis] ? "left" : "right"; //need to figure out which side to traverse
    const otherDirection = direction === "left" ? "right" : "left";

    //checking which direction and then updating point and re-calling function
    if (this[direction]) {
      bestMatch = this[direction].findNearestNeighbor(
        targetPoint,
        level + 1,
        bestMatch
      );
    }

    //EDGE CASE -- check other side if it contains a closer point
    if (
      this[otherDirection] && //checks if other branch exists
      Math.abs(targetPoint[axis] - this.point[axis]) < bestMatch.distance //checks if point in other branch is closer and if so, updates the bestMatch
    ) {
      bestMatch = this[otherDirection].findNearestNeighbor(
        targetPoint,
        level + 1,
        bestMatch
      );
    }

    return bestMatch;
  }
}

module.exports = KDTree;
