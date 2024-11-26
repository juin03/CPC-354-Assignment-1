/*-----------------------------------------------------------------------------------*/
// Variable Declaration
/*-----------------------------------------------------------------------------------*/

// Common variables
var canvas, gl, program;
var posBuffer, colBuffer, vPosition, vColor;
var modelViewMatrixLoc, projectionMatrixLoc;
var modelViewMatrix, projectionMatrix;

// Variables referencing HTML elements
// theta = [x, y, z]
var subdivSlider, subdivText, startBtn;
var theta = [0, 0, 0], subdivide = 3, scaleNum = 1, scaleMin = 0.5, scaleMax = 4, scaleSign = 1;
var animFrame = false, animFlag = false;

// Variables for the 3D Sierpinski gasket
var points = [], colors = [];

// Vertices for the 3D Sierpinski gasket (X-axis, Y-axis, Z-axis, W)
// For 3D, you need to set the z-axis to create the perception of depth
var vertices = [
    vec4( 0.0000,  0.0000, -1.0000, 1.0000),
    vec4( 0.0000,  0.9428,  0.3333, 1.0000),
    vec4(-0.8165, -0.4714,  0.3333, 1.0000),
    vec4( 0.8165, -0.4714,  0.3333, 1.0000)
];

// Different colors for a tetrahedron (RGBA)
var baseColors = [
    vec4(1.0, 0.2, 0.4, 1.0),
    vec4(0.0, 0.9, 1.0, 1.0),
    vec4(0.2, 0.2, 0.5, 1.0),
    vec4(0.0, 0.0, 0.0, 1.0)
];

// Add these variables after the baseColors declaration
var colorPickers;
var currentColors = [...baseColors]; // Create a copy of baseColors

// Add these animation state variables after the existing variable declarations
var animationState = 0; // Controls which animation phase we're in
var rotationAngle = 0;  // Current rotation angle
var moveX = 0;         // Position for random movement
var moveY = 0;
var moveVelX = 0.03;   // Velocity for random movement
var moveVelY = 0.02;

// Add these variables to your variable declarations
var iterSlider, iterText, speedSlider, speedText;
var iteration = 3;
var targetScale = 2.0; // Will be updated based on iteration
var animationSpeed = 5.0;
var bounceRadius = 1.0; // Controls the circular boundary
var bounceAngle = Math.random() * Math.PI * 2; // Random initial angle

// Add these variables for border collision
const BORDER_LEFT = -3.2;   // Adjust these values to match your brown border
const BORDER_RIGHT = 3.2;
const BORDER_TOP = 1.8;
const BORDER_BOTTOM = -1.8;
const GASKET_RADIUS = 0.5;  // Approximate radius of the gasket

// Add these constants near your other border constants
const CENTER_X = 0;  // Center X coordinate
const CENTER_Y = 0;  // Center Y coordinate
const BOUNCE_WIDTH = 2.5;  // Width of bounce area
const BOUNCE_HEIGHT = 1.0; // Height of bounce area

// Add to variable declarations section
var XrotationSlider, XrotationText;
var XnumRotations = 1;

// Add to variable declarations
var YrotationSlider, ZrotationSlider;
var YrotationAngle = 0, ZrotationAngle = 0;

// Add to existing variable declarations
let animationSequence = [];
let currentSequenceIndex = 0;
const defaultSequence = [
    {type: 'rotate', axis: 'Z', degrees: 180},
    {type: 'rotate', axis: 'Z', degrees: -180},
    {type: 'rotate', axis: 'Z', degrees: -180},
    {type: 'rotate', axis: 'Z', degrees: 180},
    {type: 'scale', scale: 2.0},
    'bounce',
    'center'
];

// Add these variables to track final states after animations
var finalRotationZ = 0;  // Tracks the final Z rotation after right/left 180

// Add to your variable declarations
var backgroundCheckbox;
var showBackground = false;

// Add to your variable declarations
var musicCheckbox;
var enableMusic = false;
var backgroundMusic;

// Add these variables to your variable declarations
var backgroundFile, musicFile;
var customBackgroundImage, customBackgroundMusic;

// Add to variable declarations section
var cumulativeRotation = {
    X: 0,
    Y: 0,
    Z: 0
};

// Add to your variable declarations at the top
var randomColorsCheckbox;
var enableRandomColors = false;


/*-----------------------------------------------------------------------------------*/
// WebGL Utilities
/*-----------------------------------------------------------------------------------*/

// Execute the init() function when the web page has fully loaded
window.onload = function init()
{
    // Primitive (geometric shape) initialization
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivide);

    // WebGL setups
    getUIElement();
    configWebGL();
    initSequenceBuilder();
    render();
}

// Retrieve all elements from HTML and store in the corresponding variables
function getUIElement()
{
    canvas = document.getElementById("gl-canvas");
    subdivSlider = document.getElementById("subdiv-slider");
    subdivText = document.getElementById("subdiv-text");
    startBtn = document.getElementById("anim-btn");
    speedSlider = document.getElementById("speed-slider");
    speedText = document.getElementById("speed-text");

    // Add color picker elements
    colorPickers = [
        document.getElementById("color1"),
        document.getElementById("color2"),
        document.getElementById("color3"),
        document.getElementById("color4")
    ];

    // Add color change listeners
    colorPickers.forEach((picker, index) => {
        picker.value = rgbaToHex(baseColors[index]);
        picker.addEventListener('input', function(event) {
            currentColors[index] = hexToRgba(event.target.value);
            recompute();
        });
    });

    // Speed slider handler
    speedSlider.onchange = function(event) {
        animationSpeed = parseFloat(event.target.value);
        speedText.innerHTML = animationSpeed.toFixed(1);
    };

    // Subdivision slider handlers
    subdivSlider.onchange = function(event) {
        subdivide = parseInt(event.target.value);
        subdivText.innerHTML = subdivide;
        recompute();
    };

    subdivSlider.oninput = function(event) {
        subdivText.innerHTML = event.target.value;
    };

    // Start/Stop button handler
    startBtn.onclick = function() {
        animFlag = !animFlag;
        if(animFlag) {
            startBtn.value = "Stop Animation";
            startBtn.classList.add('active');
            currentSequenceIndex = 0;
            resetAnimationState();
            
            if (enableMusic) {
                if (!backgroundMusic) {
                    initAudio();
                }
                backgroundMusic.play();
            }
            
            animUpdate();
        } else {
            startBtn.value = "Start Animation";
            startBtn.classList.remove('active');
            
            if (backgroundMusic) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0;
            }
            
            window.cancelAnimationFrame(animFrame);
        }
    };

    // Background and music checkboxes
    backgroundCheckbox = document.getElementById("background-checkbox");
    backgroundCheckbox.onchange = function(event) {
        showBackground = event.target.checked;
        const canvas = document.getElementById("gl-canvas");
        if (showBackground) {
            canvas.style.backgroundImage = `url(${customBackgroundImage.src})`;
            canvas.classList.add('show-background');
        } else {
            canvas.style.backgroundImage = 'none';  // This will remove the background image
            canvas.classList.remove('show-background');
        }
    };

    musicCheckbox = document.getElementById("music-checkbox");
    musicCheckbox.onchange = function(event) {
        enableMusic = event.target.checked;
        if (!enableMusic && backgroundMusic) {
            backgroundMusic.pause();
            backgroundMusic.currentTime = 0;
        }
    };

    // File upload handlers
    backgroundFile = document.getElementById("background-file");
    musicFile = document.getElementById("music-file");

    backgroundFile.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== 'image/png') {
                alert('Please select a PNG image file.');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                customBackgroundImage = new Image();
                customBackgroundImage.onload = function() {
                    // Enable the checkbox once image is loaded
                    backgroundCheckbox.disabled = false;
                    backgroundCheckbox.checked = true;
                    showBackground = true;
                    const canvas = document.getElementById("gl-canvas");
                    canvas.style.backgroundImage = `url(${e.target.result})`;
                    canvas.classList.add('show-background');
                };
                customBackgroundImage.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    musicFile.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== 'audio/mpeg') {
                alert('Please select an MP3 audio file.');
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                if (backgroundMusic) {
                    backgroundMusic.pause();
                    backgroundMusic.src = '';
                }
                
                backgroundMusic = new Audio();
                backgroundMusic.src = e.target.result;
                backgroundMusic.loop = true;
                
                // Enable the checkbox once music is loaded
                musicCheckbox.disabled = false;
                musicCheckbox.checked = true;
                enableMusic = true;
            };
            reader.readAsDataURL(file);
        }
    };

    // Add random colors checkbox handler
    randomColorsCheckbox = document.getElementById("random-colors-checkbox");
    randomColorsCheckbox.onchange = function(event) {
        enableRandomColors = event.target.checked;
    };
}

// Configure WebGL Settings
function configWebGL()
{
    // Initialize the WebGL context
    gl = WebGLUtils.setupWebGL(canvas, {
        alpha: true,  // Enable alpha channel
        premultipliedAlpha: false  // Handle alpha properly
    });
    
    if(!gl)
    {
        alert("WebGL isn't available");
    }

    // Set the viewport and clear the color
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);  // Transparent background

    // Enable hidden-surface removal
    gl.enable(gl.DEPTH_TEST);

    // Compile the vertex and fragment shaders and link to WebGL
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Create buffers and link them to the corresponding attribute variables in vertex and fragment shaders
    // Buffer for positions
    posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Buffer for colors
    colBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Get the location of the uniform variables within a compiled shader program
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
}

// Render the graphics for viewing
function render()
{
    // Cancel the animation frame before performing any graphic rendering
    window.cancelAnimationFrame(animFrame);
    
    // Clear the color buffer and the depth buffer before rendering a new frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pass a 4x4 projection matrix from JavaScript to the GPU for use in shader
    // ortho(left, right, bottom, top, near, far)
    projectionMatrix = ortho(-4, 4, -1.75, 2.75, 2, -2);
	gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // Pass a 4x4 model view matrix from JavaScript to the GPU for use in shader
    modelViewMatrix = mat4();
    modelViewMatrix = mult(modelViewMatrix, scale(1, 1, 1));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    // Draw the primitive / geometric shape
    gl.drawArrays(gl.TRIANGLES, 0, points.length);
}

// Recompute points and colors, followed by reconfiguring WebGL for rendering
function recompute()
{
    points = [];
    colors = [];
    theta = [0, 0, 0];
    scaleNum = 1;
    targetScale = 1;
    scaleSign = 1;
    animFlag = false;
    
    // Reset animation variables but keep current colors
    animationState = 0;
    rotationAngle = 0;
    moveX = 0;
    moveY = 0;
    currentIteration = 1;
    isIterating = true;
    bounceAngle = Math.random() * Math.PI * 2;

    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivide);
    configWebGL();
    render();

    currentRotationAxis = 'X';
}

// Update the animation frame
function animUpdate() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    modelViewMatrix = mat4();
    
    const speedFactor = animationSpeed / 5.0;
    const currentTime = performance.now() / 1000;
    
    // Get current animation action
    const currentAction = animationSequence[currentSequenceIndex];
    let isActionComplete = false;

    // Apply any persistent rotations first
    modelViewMatrix = mult(modelViewMatrix, rotateZ(finalRotationZ));

    // Handle the action based on its type
    if (typeof currentAction === 'object' && currentAction.type === 'rotate') {
        const rotationSpeed = 2 * speedFactor;
        const targetDegrees = currentAction.degrees;
        const rotationDirection = targetDegrees >= 0 ? 1 : -1;
        
        switch (currentAction.axis) {
            case 'X':
                rotationAngle += rotationSpeed * rotationDirection;
                if (Math.abs(rotationAngle) >= Math.abs(targetDegrees)) {
                    cumulativeRotation.X += targetDegrees;  // Add to cumulative rotation
                    rotationAngle = 0;
                    isActionComplete = true;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.X + rotationAngle, 1, 0, 0));
                break;
            case 'Y':
                YrotationAngle += rotationSpeed * rotationDirection;
                if (Math.abs(YrotationAngle) >= Math.abs(targetDegrees)) {
                    cumulativeRotation.Y += targetDegrees;  // Add to cumulative rotation
                    YrotationAngle = 0;
                    isActionComplete = true;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Y + YrotationAngle, 0, 1, 0));
                break;
            case 'Z':
                ZrotationAngle += rotationSpeed * rotationDirection;
                if (Math.abs(ZrotationAngle) >= Math.abs(targetDegrees)) {
                    cumulativeRotation.Z += targetDegrees;  // Add to cumulative rotation
                    ZrotationAngle = 0;
                    isActionComplete = true;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Z + ZrotationAngle, 0, 0, 1));
                break;
        }
    } else {
        // Apply cumulative rotations for non-rotation actions
        modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.X, 1, 0, 0));
        modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Y, 0, 1, 0));
        modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Z, 0, 0, 1));
        
        switch (currentAction.type || currentAction) {
            case 'center':
                const returnSpeed = 0.02 * speedFactor;
                moveX *= (1 - returnSpeed);
                moveY *= (1 - returnSpeed);
                rotationAngle *= (1 - returnSpeed);
                scaleNum = 1 + (scaleNum - 1) * (1 - returnSpeed);

                if (Math.abs(moveX) < 0.001 && 
                    Math.abs(moveY) < 0.001 && 
                    Math.abs(rotationAngle) < 0.001 && 
                    Math.abs(scaleNum - 1) < 0.001) {
                    moveX = 0;
                    moveY = 0;
                    rotationAngle = 0;
                    scaleNum = 1;
                    isActionComplete = true;
                }
                break;

            case 'scale':
                const targetScale = currentAction.scale;
                const scaleDiff = targetScale - scaleNum;
                const scaleSpeed = 0.02 * speedFactor;
                
                if (Math.abs(scaleDiff) < scaleSpeed) {
                    scaleNum = targetScale;
                    isActionComplete = true;
                } else {
                    scaleNum += Math.sign(scaleDiff) * scaleSpeed;
                }
                break;

            case 'bounce':
                if (!isBouncing) {
                    bounceStartTime = currentTime;
                    isBouncing = true;
                    bounceTimer = currentAction.duration;
                }

                const moveSpeed = 0.03 * speedFactor;
                const nextX = moveX + Math.cos(bounceAngle) * moveSpeed;
                const nextY = moveY + Math.sin(bounceAngle) * moveSpeed;
                
                // Check for collisions and update colors
                let collision = false;
                if (Math.abs(nextX) > BOUNCE_WIDTH) {
                    bounceAngle = Math.PI - bounceAngle;
                    bounceAngle += (Math.random() - 0.5) * 0.2;
                    collision = true;
                }
                if (Math.abs(nextY) > BOUNCE_HEIGHT) {
                    bounceAngle = -bounceAngle;
                    bounceAngle += (Math.random() - 0.5) * 0.2;
                    collision = true;
                }
                
                // Only update colors if random colors are enabled
                if (collision && enableRandomColors) {
                    updateRandomColors();
                }
                
                moveX += Math.cos(bounceAngle) * moveSpeed;
                moveY += Math.sin(bounceAngle) * moveSpeed;

                if (currentTime - bounceStartTime >= bounceTimer) {
                    isBouncing = false;
                    isActionComplete = true;
                }
                break;
        }
    }

    // Apply common transformations
    modelViewMatrix = mult(modelViewMatrix, translate(moveX, moveY, 0));
    modelViewMatrix = mult(modelViewMatrix, scale(scaleNum, scaleNum, scaleNum));
    
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    // Handle sequence progression
    if (isActionComplete) {
        currentSequenceIndex++;
        if (currentSequenceIndex >= animationSequence.length) {
            // Animation sequence complete - just stop the animation without resetting
            currentSequenceIndex = 0;
            animFlag = false;
            startBtn.value = "Start Animation";
            startBtn.classList.remove('active');
            
            // Only stop the music if it's playing
            if (backgroundMusic) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0;
            }
            
            return;  // Keep the final state by removing resetAnimationState() and render()
        }
        resetActionState();  // Only reset temporary action-specific states
    }

    if (animFlag) {
        animFrame = window.requestAnimationFrame(animUpdate);
    }
}

// Add these helper functions
function resetAnimationState() {
    moveX = 0;
    moveY = 0;
    rotationAngle = 0;
    YrotationAngle = 0;
    ZrotationAngle = 0;
    cumulativeRotation = { X: 0, Y: 0, Z: 0 };  // Reset cumulative rotations
    scaleNum = 1;
    targetScale = 1;
    isBouncing = false;
    currentSequenceIndex = 0;
    
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

function resetActionState() {
    rotationAngle = 0;
    YrotationAngle = 0;
    ZrotationAngle = 0;
    isBouncing = false;
}

/*-----------------------------------------------------------------------------------*/
// 3D Sierpinski Gasket
/*-----------------------------------------------------------------------------------*/

// Form a triangle
function triangle(a, b, c, color)
{
    colors.push(currentColors[color]);
    points.push(a);
    colors.push(currentColors[color]);
    points.push(b);
    colors.push(currentColors[color]);
    points.push(c);
}

// Form a tetrahedron with different color for each side
function tetra(a, b, c, d)
{
    triangle(a, c, b, 0);
    triangle(a, c, d, 1);
    triangle(a, b, d, 2);
    triangle(b, c, d, 3);
}

// Subdivide a tetrahedron
function divideTetra(a, b, c, d, count)
{
    // Check for end of recursion
    if(count === 0)
    {
        tetra(a, b, c, d);
    }

    // Find midpoints of sides and divide into four smaller tetrahedra
    else
    {
        var ab = mix(a, b, 0.5);
        var ac = mix(a, c, 0.5);
        var ad = mix(a, d, 0.5);
        var bc = mix(b, c, 0.5);
        var bd = mix(b, d, 0.5);
        var cd = mix(c, d, 0.5);
        --count;

        divideTetra(a, ab, ac, ad, count);
        divideTetra(ab, b, bc, bd, count);
        divideTetra(ac, bc, c, cd, count);
        divideTetra(ad, bd, cd, d, count);
    }
}

/*-----------------------------------------------------------------------------------*/

// Add these utility functions at the end of the file
function rgbaToHex(rgba) {
    return '#' + 
        Math.round(rgba[0] * 255).toString(16).padStart(2, '0') +
        Math.round(rgba[1] * 255).toString(16).padStart(2, '0') +
        Math.round(rgba[2] * 255).toString(16).padStart(2, '0');
}

function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return vec4(r, g, b, 1.0);
}

// Add these functions after your existing variable declarations
function initSequenceBuilder() {
    const sequenceContainer = document.getElementById('animation-sequence');
    const clearBtn = document.getElementById('clear-sequence');
    const resetBtn = document.getElementById('reset-default');
    
    // Add click handlers for action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            addToSequence(this.dataset.action);
        });
    });
    
    clearBtn.addEventListener('click', clearSequence);
    resetBtn.addEventListener('click', resetToDefault);
    
    // Initialize with default sequence
    resetToDefault();
}

function addToSequence(action) {
    if (action.startsWith('rotate')) {
        animationSequence.push({
            type: 'rotate',
            axis: action.slice(-1),
            degrees: 360
        });
    } else if (action === 'scale') {
        animationSequence.push({
            type: 'scale',
            scale: 1.0
        });
    } else if (action === 'bounce') {
        animationSequence.push({
            type: 'bounce',
            duration: 5.0  // Default duration
        });
    } else {
        animationSequence.push(action);
    }
    updateSequenceDisplay();
}

function removeFromSequence(index) {
    animationSequence.splice(index, 1);
    updateSequenceDisplay();
}

function clearSequence() {
    animationSequence = [];
    updateSequenceDisplay();
}

function resetToDefault() {
    animationSequence = [...defaultSequence];
    updateSequenceDisplay();
}

function updateSequenceDisplay() {
    const container = document.getElementById('animation-sequence');
    container.innerHTML = '';
    
    animationSequence.forEach((action, index) => {
        const item = document.createElement('div');
        item.className = 'sequence-item';
        
        if (typeof action === 'object') {
            if (action.type === 'rotate') {
                item.innerHTML = `
                    Rotate ${action.axis}: 
                    <input type="number" class="rotation-value" value="${action.degrees}" 
                           min="-360" max="360" step="90"
                           onchange="updateRotationValue(${index}, this.value)">°
                    <button class="remove-btn" onclick="removeFromSequence(${index})">×</button>
                `;
            } else if (action.type === 'scale') {
                item.innerHTML = `
                    Scale to: 
                    <input type="number" class="scale-value" value="${action.scale}" 
                           min="0.1" max="5" step="0.1"
                           onchange="updateScaleValue(${index}, this.value)">×
                    <button class="remove-btn" onclick="removeFromSequence(${index})">×</button>
                `;
            } else if (action.type === 'bounce') {
                item.innerHTML = `
                    Bounce for: 
                    <input type="number" class="bounce-value" value="${action.duration}" 
                           min="1" max="20" step="0.5"
                           onchange="updateBounceValue(${index}, this.value)">s
                    <button class="remove-btn" onclick="removeFromSequence(${index})">×</button>
                `;
            }
        } else {
            item.innerHTML = `
                ${action}
                <button class="remove-btn" onclick="removeFromSequence(${index})">×</button>
            `;
        }
        container.appendChild(item);
    });
}

// Modify initAudio to work with uploaded music
function initAudio() {
    if (!backgroundMusic) {
        backgroundMusic = new Audio();
        backgroundMusic.loop = true;
    }
}

// Add this function to clean up resources
function cleanup() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.src = '';
    }
    const canvas = document.getElementById("gl-canvas");
    canvas.style.backgroundImage = '';
    canvas.classList.remove('show-background');
}

// Update the updateRotationValue function
function updateRotationValue(index, value) {
    const degrees = parseInt(value) || 360;
    if (typeof animationSequence[index] === 'object' && animationSequence[index].type === 'rotate') {
        animationSequence[index].degrees = degrees;
    }
}

// Add this new function for handling scale value updates
function updateScaleValue(index, value) {
    const scale = parseFloat(value) || 1.0;
    if (typeof animationSequence[index] === 'object' && 
        (animationSequence[index].type === 'scale')) {
        animationSequence[index].scale = scale;
    }
}

// Add this helper function to generate random colors
function getRandomColor() {
    return vec4(
        Math.random(),  // R
        Math.random(),  // G
        Math.random(),  // B
        1.0            // A
    );
}

// Add this function to update colors and recompute the gasket
function updateRandomColors() {
    // Update each face with a random color
    for (let i = 0; i < currentColors.length; i++) {
        currentColors[i] = getRandomColor();
        // Update the color picker UI to reflect the new color
        colorPickers[i].value = rgbaToHex(currentColors[i]);
    }
    
    // Recompute the gasket with new colors
    points = [];
    colors = [];
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivide);
    
    // Update the buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
}

