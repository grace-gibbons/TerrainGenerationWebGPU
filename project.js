
// Various global variables
let adapter,
    device,
    context,
    pipeline,
    renderPassDesc,
    canvas,
    uniformBindGroup,
    uniformValues,
    indices;

// Shader code variables
let code,
    shaderDesc,
    module,
    colorState;

// Background texture variables
let bindGroup,
    texturePipeline,
    textureCode,
    textureShaderDesc,
    textureModule,
    textureRenderPassDesc;

// Buffers
let myVertexBuffer = null;
let myIndexBuffer = null;
let myColorBuffer = null;
let uniformBuffer;

// Points that define the triangles that make up our world
let points;
let colors;

// Size of the map in "squares" (made of triangles)
var mapSize = 17;

// Handles rotation and translation
let translation = [0.0, 0.0, -0.6, 0.0];
let angles = [50.0, 0.0, 0.0, 0.0];

// Heightmap information for the first landmass
// Holds the height of each vertex, determined by the diamond square algorithm
let heightMapA;
// Maximum and minimum heights
let minHA, maxHA;

// Heightmap information for the second landmass
// Holds the height of each vertex, determined by the diamond square algorithm
let heightMapB;
// Maximum and minimum heights
let minHB, maxHB;

// Set up the shader from the info in the html file
function setShaderInfo() {
    code = document.getElementById('shader').innerText;
    shaderDesc = { code: code };
    module = device.createShaderModule(shaderDesc);
    colorState = {
        format: 'bgra8unorm'
    };

    depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
}

// Initialize the program with all the things WebGPU needs
async function initProgram() {
    // Get canvas
    canvas = document.querySelector("canvas");

    // Make sure WebGPU is supported in the browser
    if (!navigator.gpu) {
        console.error("WebGPU not supported on this browser.");
        return;
    }

    // Get webgpu browser software layer for graphics device
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("No appropriate GPUAdapter found.");
        return;
    }

    // Get the instantiation of webgpu on this device
    device = await adapter.requestDevice();
    if (!device) {
        console.error("Failed to request Device.");
        return;
    }

    // Configure the canvas
    context = canvas.getContext('webgpu');
    const canvasConfig = {
        device: device,
        // format is the pixel format
        format: navigator.gpu.getPreferredCanvasFormat(),
        // usage is set up for rendering to the canvas
        usage:
            GPUTextureUsage.RENDER_ATTACHMENT,
        alphaMode: 'opaque'
    };
    context.configure(canvasConfig);
}

// Create the world
function createShape() {
    // Clear old values
    points = [];
    indices = [];
    colors = [];

    // Add triangles to world
    makeWorld();

    /////////////////////////////////////////////
    // Setup Vertex Buffer

    // Attribute for vertices
    const vertexAttribDesc = {
        shaderLocation: 0, // @location(0) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: x,y,z
    };

    // Buffer layout
    const vertexBufferLayoutDesc = {
        attributes: [vertexAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // sizeof(float) * 3 floats
        stepMode: 'vertex'
    };

    // Buffer layout and filling
    const vertexBufferDesc = {
        size: points.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myVertexBuffer = device.createBuffer(vertexBufferDesc);
    let writeArray = new Float32Array(myVertexBuffer.getMappedRange());

    // Copy buffer
    writeArray.set(points); 
    myVertexBuffer.unmap();


    /////////////////////////////////////////////
    // Setup Color Buffer

    // Attribute for color
    const colorAttribDesc = {
        shaderLocation: 1, // @location(1) in vertex shader
        offset: 0,
        format: 'float32x3' // 3 floats: r,g,b
    };

    // Setup layout
    const myColorBufferLayoutDesc = {
        attributes: [colorAttribDesc],
        arrayStride: Float32Array.BYTES_PER_ELEMENT * 3, // 3 colors (rgb)
        stepMode: 'vertex'
    };

    // Buffer layout and filling
    const myColorBufferDesc = {
        size: colors.length * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };
    myColorBuffer = device.createBuffer(myColorBufferDesc);
    let writeColorArray = new Float32Array(myColorBuffer.getMappedRange());

    // Copy Buffer
    writeColorArray.set(colors); 
    myColorBuffer.unmap();


    /////////////////////////////////////////////
    // Setup Index Buffer

    // Make sure mapped ranged is multiple of 4 (unit16 is 2, not 4 bytes)
    if (indices.length % 2 != 0) {
        indices.push(indices[indices.length - 1]);
    }

    const myIndexBufferDesc = {
        size: indices.length * Uint16Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
    };

    myIndexBuffer = device.createBuffer(myIndexBufferDesc);
    let writeIndexArray = new Uint16Array(myIndexBuffer.getMappedRange());

    // Copy buffer
    writeIndexArray.set(indices);
    myIndexBuffer.unmap();


    /////////////////////////////////////////////
    // Setup Uniform Bind Group

    // Set up the uniform var
    let uniformBindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {}
            },
        ]
    });

    /////////////////////////////////////////////
    // Setup Terrain Pipeline

    // Pipeline layout
    const pipelineLayoutDesc = { bindGroupLayouts: [uniformBindGroupLayout] };
    const layout = device.createPipelineLayout(pipelineLayoutDesc);

    const pipelineDesc = {
        layout: layout,
        vertex: {
            module,
            entryPoint: 'vs',
            buffers: [vertexBufferLayoutDesc, myColorBufferLayoutDesc]
        },
        fragment: {
            module,
            entryPoint: 'fs',
            targets: [colorState]
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: 'cw',
            cullMode: 'none'
        }
    };

    pipeline = device.createRenderPipeline(pipelineDesc);

    /////////////////////////////////////////////
    // Setup Uniform Buffer

    const uniformBufferSize =
        4 * 4 + // translation is 4 32bit floats (4 bytes each)
        4 * 4;  // angles are 4 32bit floats (4 bytes each)

    uniformValues = new Float32Array(uniformBufferSize / 4);

    // Offsets in the shader
    const translationOffset = 0;
    const angleOffset = 4;

    uniformValues.set(translation, translationOffset);
    uniformValues.set(angles, angleOffset);

    uniformBuffer = device.createBuffer({
        size: uniformValues.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                },
            },
        ],
    });
}

// Render the scene
function render() {
    // Get current texture from the canvas, set it as texture to render to
    const canvasTexture = context.getCurrentTexture();

    /////////////////////////////////////////////
    // Create Render Pass Descriptions

    renderPassDesc = {
        label: 'terrain renderPass',
        colorAttachments: [
            {
                clearValue: [0.3, 0.5, 0.7, 1], // Background color
                loadOp: 'load',
                storeOp: 'store',
            },
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),

            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    };

    renderPassDesc.colorAttachments[0].view = canvasTexture.createView();

    // Convert to radians
    uniformValues[4] = radians(angles[0]);
    uniformValues[5] = radians(angles[1]);
    uniformValues[6] = radians(angles[2]);

    // Copy the values from JavaScript to the GPU
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const encoder = device.createCommandEncoder();

    // Render Terrain
    const pass = encoder.beginRenderPass(renderPassDesc);
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, uniformBindGroup);
    pass.setVertexBuffer(0, myVertexBuffer);
    pass.setVertexBuffer(1, myColorBuffer);
    pass.setIndexBuffer(myIndexBuffer, "uint16");
    pass.drawIndexed(indices.length, 1);
    pass.end();

    const commandBuffer = encoder.finish();
    device.queue.submit([commandBuffer]);
}

async function main() {
    await initProgram();

    // Configure shader
    setShaderInfo();

    // Allow keyboard input
    window.addEventListener('keydown', gotKey, false);

    // Calculate the heightmap for landmass 1
    var dsA = diamondSquare(0.1);
    heightMapA = dsA[0];
    minHA = dsA[1];
    maxHA = dsA[2];

    // Calculate the heightmap for landmass 2
    var dsB = diamondSquare(0.5);
    heightMapB = dsB[0];
    minHB = dsB[1];
    maxHB = dsB[2];

    createShape();

    render();    
}

main();
