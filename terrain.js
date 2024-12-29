// Handles generating and adding triangles that make up the terrain

// Convert degrees to radians
function radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}

// Add triangles to the scene
function makeWorld() {
    var size = 1 / (mapSize - 1);

    // Landmass 1

    var xIndex = 0;
    var yIndex = 0;

    for (var z = -0.6; z < 0.4; z += size) {
        for (var x = -1; x < 0; x += size) {
            addTriangleLandA(x, heightMapA[xIndex][yIndex], z,
                x + size, heightMapA[xIndex + 1][yIndex + 1], z + size,
                x, heightMapA[xIndex][yIndex + 1], z + size);

            addTriangleLandA(x, heightMapA[xIndex][yIndex], z,
                x + size, heightMapA[xIndex + 1][yIndex], z,
                x + size, heightMapA[xIndex + 1][yIndex + 1], z + size);

            xIndex++;
        }
        xIndex = 0;
        yIndex++;
    }


    // Landmass 2

    xIndex = 0;
    yIndex = 0;

    for (var z = -0.3; z < 0.5; z += size) {
        for (var x = 0.2; x < 1; x += size) {
            addTriangleLandB(x, heightMapB[xIndex][yIndex], z,
                x + size, heightMapB[xIndex + 1][yIndex + 1], z + size,
                x, heightMapB[xIndex][yIndex + 1], z + size);

            addTriangleLandB(x, heightMapB[xIndex][yIndex], z,
                x + size, heightMapB[xIndex + 1][yIndex], z,
                x + size, heightMapB[xIndex + 1][yIndex + 1], z + size);

            xIndex++;
        }
        xIndex = 0;
        yIndex++;
    }
}


// Get the maximum height of the given heightMap
function getMaxHeight(heightMap) {
    var maxH = heightMap[0][0];
    for (var i = 0; i < mapSize; i++) {
        for (var j = 0; j < mapSize; j++) {
            if (heightMap[i][j] > maxH) {
                maxH = heightMap[i][j];
            }
        }
    }
    return maxH;
}

// Get the minimum height of the given heightMap
function getMinHeight(heightMap) {
    var minH = heightMap[0][0];
    for (var i = 0; i < mapSize; i++) {
        for (var j = 0; j < mapSize; j++) {
            if (heightMap[i][j] < minH) {
                minH = heightMap[i][j];
            }
        }
    }
    return minH;
}

// Diamond square algorithm, which determines a height for each vertex
//
// randomness Will determine the height features of the map
// Smaller values favor hilly terrain, and larger values feature mountains or deep valleys
function diamondSquare(randomness) {
    // Create 2D array heightmap, to simulate the initial square
    var heightMap = Array.from({ length: mapSize }, () => new Array(mapSize));

    // Set the corners to the same random height
    var start = 0;
    heightMap[0][0] = start;
    heightMap[mapSize - 1][0] = start;
    heightMap[0][mapSize - 1] = start;
    heightMap[mapSize - 1][mapSize - 1] = start;

    // Keeps track of the width as we decrease it, when looping over the map
    var mapWidth = mapSize - 1;

    // Loop over map
    while (mapWidth > 1) {
        var halfmapWidth = Math.floor(mapWidth / 2);

        // Diamond values
        for (var x = 0; x < mapSize - 1; x += mapWidth) {
            for (var y = 0; y < mapSize - 1; y += mapWidth) {
                // Sum of all the corners
                var cornerSum = heightMap[x][y] + heightMap[x + mapWidth][y] + heightMap[x][y + mapWidth] +
                    heightMap[x + mapWidth][y + mapWidth];

                var average = cornerSum / 4;
                var rand = Math.random() * (randomness - (-randomness)) + (-randomness);
                average += rand;

                heightMap[x + halfmapWidth][y + halfmapWidth] = average;
            }
        }

        // Square values
        for (var x = 0; x < mapSize - 1; x += halfmapWidth) {
            for (var y = (x + halfmapWidth) % mapWidth; y < mapSize - 1; y += mapWidth) {
                var average = heightMap[(x - halfmapWidth + mapSize - 1) % (mapSize - 1)][y] +
                    heightMap[(x + halfmapWidth) % (mapSize - 1)][y] +
                    heightMap[x][(y + halfmapWidth) % (mapSize - 1)] +
                    heightMap[x][(y - halfmapWidth + mapSize - 1) % (mapSize - 1)];

                average /= 4;
                // Get rid of this to make less hilly
                var rand = Math.random() * (randomness - (-randomness)) + (-randomness);
                average += rand;

                heightMap[x][y] = average;

                // If values wrap around
                if (x == 0) {
                    heightMap[mapSize - 1][y] = average;
                }

                if (y == 0) {
                    heightMap[x][mapSize - 1] = average;
                }
            }
        }

        // Reduce the randomness a bit, but make sure it is never 0
        randomness = Math.max(Math.floor(randomness / 2), 0.1)

        mapWidth = Math.floor(mapWidth / 2);
    }

    // Display generated values, for debugging purposes
    /*
    console.log("---DISPLAY---");
    for (var i = 0; i < mapSize; i++) {
        for (var j = 0; j < mapSize; j++) {
            console.log("i: " + i + " j: " + j + " | " + heightMap[i][j]);
        }
    }
    */

    var minH = getMinHeight(heightMap);
    var maxH = getMaxHeight(heightMap);

    return [heightMap, minH, maxH];
}


// Based on the given height, determine the color of the vertex
// Gives Earth-terrain colors
function pickColorEarth(height) {
    // Split up the given region by the max and min, so we get a spread of terrain colors
    var diff = maxHA - minHA;
    var region = diff / 5;

    var r = 0;
    var g = 0;
    var b = 0;

    if (height >= minHA && height < minHA + region) {
        // Blue
        r = 0.243;
        g = 0.612;
        b = 0.788;
    } else if (height >= minHA + region && height < minHA + region * 2) {
        // Tan
        r = 0.941;
        g = 0.839;
        b = 0.686;
    } else if (height >= minHA + region * 2 && height < minHA + region * 3) {
        // Light Green
        r = 0.639;
        g = 0.878;
        b = 0.424;
    } else if (height >= minHA + region * 3 && height < minHA + region * 4) {
        // Green
        r = 0.243;
        g = 0.612;
        b = 0.118;
    } else if (height >= minHA + region * 4 && height <= maxHA) {
        // Brown
        r = 0.361;
        g = 0.282;
        b = 0.161;
    }

    return [r, g, b];
}

// Based on the given height, determine the color of the vertex
// Gives Mars-like terrain colors
function pickColorMars(height) {
    // Split up the given region by the max and min, so we get a spread of terrain colors
    var diff = maxHB - minHB;
    var region = diff / 5;

    var r = 0;
    var g = 0;
    var b = 0;

    if (height >= minHB && height < minHB + region) {
        // Purple
        r = 0.31;
        g = 0.043;
        b = 0.859;
    } else if (height >= minHB + region && height < minHB + region * 2) {
        // Tan
        r = 0.772;
        g = 0.651;
        b = 0.455;
    } else if (height >= minHB + region * 2 && height < minHB + region * 3) {
        // Light Red
        r = 0.91;
        g = 0.431;
        b = 0.322;
    } else if (height >= minHB + region * 3 && height < minHB + region * 4) {
        // Red
        r = 0.831;
        g = 0.165;
        b = 0.067;
    } else if (height >= minHB + region * 4 && height <= maxHB) {
        // Orange
        r = 0.929;
        g = 0.549;
        b = 0.114;
    }

    return [r, g, b];
}

// Add a triangle to landmass A
function addTriangleLandA(x0, y0, z0, x1, y1, z1, x2, y2, z2) {
    var nverts = points.length / 3;

    var r, g, b;

    // Choose color for first vertex
    r = pickColorEarth(y0)[0];
    g = pickColorEarth(y0)[1];
    b = pickColorEarth(y0)[2];

    // push first vertex
    points.push(x0); colors.push(r);
    points.push(y0); colors.push(g);
    points.push(z0); colors.push(b);
    indices.push(nverts);
    nverts++;

    // Choose color for second vertex
    r = pickColorEarth(y1)[0];
    g = pickColorEarth(y1)[1];
    b = pickColorEarth(y1)[2];

    // push second vertex
    points.push(x1); colors.push(r);
    points.push(y1); colors.push(g);
    points.push(z1); colors.push(b);
    indices.push(nverts);
    nverts++

    // Choose color for third vertex
    r = pickColorEarth(y2)[0];
    g = pickColorEarth(y2)[1];
    b = pickColorEarth(y2)[2];

    // push third vertex
    points.push(x2); colors.push(r);
    points.push(y2); colors.push(g);
    points.push(z2); colors.push(b);
    indices.push(nverts);
    nverts++;
}

// Add a triangle to landmass B
function addTriangleLandB(x0, y0, z0, x1, y1, z1, x2, y2, z2) {
    var nverts = points.length / 3;

    var r, g, b;

    // Choose color for first vertex
    r = pickColorMars(y0)[0];
    g = pickColorMars(y0)[1];
    b = pickColorMars(y0)[2];

    // push first vertex
    points.push(x0); colors.push(r);
    points.push(y0); colors.push(g);
    points.push(z0); colors.push(b);
    indices.push(nverts);
    nverts++;

    // Choose color for second vertex
    r = pickColorMars(y1)[0];
    g = pickColorMars(y1)[1];
    b = pickColorMars(y1)[2];

    // push second vertex
    points.push(x1); colors.push(r);
    points.push(y1); colors.push(g);
    points.push(z1); colors.push(b);
    indices.push(nverts);
    nverts++

    // Choose color for third vertex
    r = pickColorMars(y2)[0];
    g = pickColorMars(y2)[1];
    b = pickColorMars(y2)[2];

    // push third vertex
    points.push(x2); colors.push(r);
    points.push(y2); colors.push(g);
    points.push(z2); colors.push(b);
    indices.push(nverts);
    nverts++;
}