// Variable Declaration

/*----------------------------------------------------------------------------*/
//  WebGL Core Variables
/*----------------------------------------------------------------------------*/
var canvas, gl, program;
var posBuffer, colBuffer, vPosition, vColor;
var modelViewMatrixLoc, projectionMatrixLoc;
var modelViewMatrix, projectionMatrix;

/*----------------------------------------------------------------------------*/
//  Sierpinski Gasket Variables
/*----------------------------------------------------------------------------*/
// Core geometry and color data
var points = [], colors = [];

// Vertices for the 3D Sierpinski gasket (X-axis, Y-axis, Z-axis, W)
var vertices = [
    vec4( 0.0000,  0.0000, -1.0000, 1.0000),
    vec4( 0.0000,  0.9428,  0.3333, 1.0000),
    vec4(-0.8165, -0.4714,  0.3333, 1.0000),
    vec4( 0.8165, -0.4714,  0.3333, 1.0000)
];

// Color configuration
var baseColors = [
    vec4(1.0, 0.2, 0.4, 1.0),
    vec4(0.0, 0.9, 1.0, 1.0),
    vec4(0.2, 0.2, 0.5, 1.0),
    vec4(0.0, 0.0, 0.0, 1.0)
];

// Add these variables after the baseColors declaration
var colorPickers;
var currentColors = [...baseColors]; // Create a copy of baseColors
var randomColorsCheckbox;
var enableRandomColors = false;

/*----------------------------------------------------------------------------*/
//  Animation Variables
/*----------------------------------------------------------------------------*/
// Core animation state
var animFrame = false, animFlag = false;
let isPaused = false;
var animationState = 0; // Controls which animation phase we're in
var animationSpeed = 5.0;

// Rotation variables
var theta = [0, 0, 0];
var XrotationAngle = 0, YrotationAngle = 0, ZrotationAngle = 0;
var cumulativeRotation = {
    X: 0,
    Y: 0,
    Z: 0
};

// Movement and scaling variables
var moveX = 0, moveY = 0;
var scaleNum = 1;
var scaleMin = 0.5;
var scaleMax = 4;
var scaleSign = 1;
var targetScale = 2.0;

// Bounce configuration
var bounceAngle = Math.random() * Math.PI * 2; // Random initial angle
const BOUNCE_WIDTH = 2.5; // Width of bounce area
const BOUNCE_HEIGHT = 1.0; // Height of bounce area

// Animation sequence control
let animationSequence = [];
let currentSequenceIndex = 0;
const defaultSequence = [
    {type: 'rotate', axis: 'Z', degrees: -180},
    {type: 'rotate', axis: 'Z', degrees: 180},
    {type: 'rotate', axis: 'Z', degrees: 180},
    {type: 'rotate', axis: 'Z', degrees: -180},
    {type: 'scale', scale: 2.0},
    {type: 'bounce', duration: Infinity, infinite: true},
];

/*----------------------------------------------------------------------------*/
//  UI Control Variables
/*----------------------------------------------------------------------------*/
// Subdivision controls
var subdivSlider, subdivText;
var subdivide = 3;

// Speed controls
var speedSlider, speedText;

// Button controls
var startBtn;

// Background controls
var backgroundCheckbox;
var showBackground = true;
var backgroundFile;
var customBackgroundImage;
const DEFAULT_BACKGROUND_IMAGE = 'iceBackground.png';

// Music controls
var musicCheckbox;
var enableMusic = true;
var musicFile;
var backgroundMusic;
var customBackgroundMusic;
const DEFAULT_BACKGROUND_MUSIC = 'jingleBell.mp3';

/*----------------------------------------------------------------------------*/
// WebGL Utilities
/*----------------------------------------------------------------------------*/

// Execute the init() function when the web page has fully loaded
window.onload = function init()
{
    // Get UI elements first
    getUIElement();

    // Initialize the gasket
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], subdivide);

    // Configure WebGL after gasket initialization
    configWebGL();

    // Load default assets
    loadDefaultAssets();

    // Initialize sequence builder
    initSequenceBuilder();

    // Initial render
    render();

    // Enable panel interactivity
    togglePanelInteractivity(true);
}

// Load default background and music
function loadDefaultAssets() {
    // Load default background image
    customBackgroundImage = new Image();
    customBackgroundImage.onload = function() {
        backgroundCheckbox.disabled = false;
        backgroundCheckbox.checked = true;
        showBackground = true;
        const canvas = document.getElementById("gl-canvas");
        canvas.style.backgroundImage = `url(${DEFAULT_BACKGROUND_IMAGE})`;
        canvas.classList.add('show-background');
    };
    customBackgroundImage.src = DEFAULT_BACKGROUND_IMAGE;

    // Load default background music
    backgroundMusic = new Audio(DEFAULT_BACKGROUND_MUSIC);
    backgroundMusic.loop = true;
    musicCheckbox.disabled = false;
    musicCheckbox.checked = true;
    enableMusic = true;
 
}

// Retrieve all elements from HTML and store in the corresponding variables
function getUIElement()
{
    canvas = document.getElementById("gl-canvas");
    subdivSlider = document.getElementById("subdiv-slider");
    subdivText = document.getElementById("subdiv-text");
    startBtn = document.getElementById("anim-btn");
    resetBtn = document.getElementById("reset-btn");
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
            if (isPaused) {
                // Resuming from pause - don't change panel interaction
                startBtn.value = "Stop Animation";
                startBtn.classList.add('active');
                
                // if (enableMusic && backgroundMusic) {
                //     backgroundMusic.play();
                // }
                
                animUpdate();
                isPaused = false;
            } else {
                // Starting fresh animation - disable panel interaction
                startBtn.value = "Stop Animation";
                startBtn.classList.add('active');
                currentSequenceIndex = 0;
                resetAnimationState();
                togglePanelInteractivity(false);  // Disable panel only when starting fresh
                
                if (enableMusic) {
                    if (!backgroundMusic) {
                        initAudio();
                    }
                    backgroundMusic.play();
                }
                
                animUpdate();
            }
        } else {
            // Stopping/Pausing - don't change panel interaction
            startBtn.value = "Resume Animation";
            startBtn.classList.remove('active');
            
            if (backgroundMusic) {
                backgroundMusic.pause();
            }
            
            isPaused = true;
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

            // Update the label with the new file name
            const backgroundFileLabel = document.querySelector('label[for="background-file"]');
            backgroundFileLabel.textContent = `Background Image (PNG): ${file.name}`;

            const reader = new FileReader();
            reader.onload = function(e) {
                customBackgroundImage = new Image();
                customBackgroundImage.onload = function() {
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

            // Update the label with the new file name
            const musicFileLabel = document.querySelector('label[for="music-file"]');
            musicFileLabel.textContent = `Background Music (MP3): ${file.name}`;

            const reader = new FileReader();
            reader.onload = function(e) {
                if (backgroundMusic) {
                    backgroundMusic.pause();
                    backgroundMusic.src = '';
                }
                
                backgroundMusic = new Audio();
                backgroundMusic.src = e.target.result;
                backgroundMusic.loop = true;
                
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

    // Update file input displays to show default files
    const backgroundFileLabel = document.querySelector('label[for="background-file"]');
    backgroundFileLabel.textContent = `Background Image (PNG): ${DEFAULT_BACKGROUND_IMAGE}`;

    const musicFileLabel = document.querySelector('label[for="music-file"]');
    musicFileLabel.textContent = `Background Music (MP3): ${DEFAULT_BACKGROUND_MUSIC}`;

    // Add reset button handler
    resetBtn.onclick = function() {
        // Clean up resources before refreshing
        cleanup();
        // Refresh the page
        window.location.reload();
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
    XrotationAngle = 0;
    YrotationAngle = 0;
    ZrotationAngle = 0;
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
    
    const speedFactor = animationSpeed / 2.0 ;
    const currentAction = animationSequence[currentSequenceIndex];
    var isActionComplete = false;

    // Apply translation first
    modelViewMatrix = mult(modelViewMatrix, translate(moveX, moveY, 0));

    // Handle rotation actions
    if (typeof currentAction === 'object' && currentAction.type === 'rotate') {
        const rotationSpeed = 2 * speedFactor;
        const targetDegrees = currentAction.degrees;
        
        switch (currentAction.axis) {
            case 'X':
                // Calculate remaining degrees to target
                const remainingX = targetDegrees - XrotationAngle;
                // Apply smaller of: rotation speed or remaining degrees
                const stepX = Math.min(Math.abs(remainingX), rotationSpeed) * Math.sign(remainingX);
                XrotationAngle += stepX;
                
                if (Math.abs(remainingX) <= rotationSpeed) {
                    cumulativeRotation.X += targetDegrees;
                    XrotationAngle = 0;
                    isActionComplete = true;
                }
                break;
                
            case 'Y':
                const remainingY = targetDegrees - YrotationAngle;
                const stepY = Math.min(Math.abs(remainingY), rotationSpeed) * Math.sign(remainingY);
                YrotationAngle += stepY;
                
                if (Math.abs(remainingY) <= rotationSpeed) {
                    cumulativeRotation.Y += targetDegrees;
                    YrotationAngle = 0;
                    isActionComplete = true;
                }
                break;
                
            case 'Z':
                const remainingZ = targetDegrees - ZrotationAngle;
                const stepZ = Math.min(Math.abs(remainingZ), rotationSpeed) * Math.sign(remainingZ);
                ZrotationAngle += stepZ;
                
                if (Math.abs(remainingZ) <= rotationSpeed) {
                    cumulativeRotation.Z += targetDegrees;
                    ZrotationAngle = 0;
                    isActionComplete = true;
                }
                break;
        }
    }

    // Apply all rotations in order
    modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.X + XrotationAngle, 1, 0, 0));
    modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Y + YrotationAngle, 0, 1, 0));
    modelViewMatrix = mult(modelViewMatrix, rotate(cumulativeRotation.Z + ZrotationAngle, 0, 0, 1));

    // Handle non-rotation actions
    if (currentAction && typeof currentAction === 'object') {
        switch (currentAction.type) {
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
                    bounceStartTime = performance.now() / 1000;
                    isBouncing = true;
                }

                const moveSpeed = 0.03 * speedFactor;
                const nextX = moveX + Math.cos(bounceAngle) * moveSpeed;
                const nextY = moveY + Math.sin(bounceAngle) * moveSpeed;
                
                // Check boundary collisions
                if (Math.abs(nextX) > BOUNCE_WIDTH) {
                    bounceAngle = Math.PI - bounceAngle;
                    bounceAngle += (Math.random() - 0.5) * 0.2;
                    if (enableRandomColors) updateRandomColors();
                }
                if (Math.abs(nextY) > BOUNCE_HEIGHT) {
                    bounceAngle = -bounceAngle;
                    bounceAngle += (Math.random() - 0.5) * 0.2;
                    if (enableRandomColors) updateRandomColors();
                }
                
                moveX += Math.cos(bounceAngle) * moveSpeed;
                moveY += Math.sin(bounceAngle) * moveSpeed;

                // Only check duration if not infinite
                if (!currentAction.infinite) {
                    const currentTime = performance.now() / 1000;
                    const elapsedTime = currentTime - bounceStartTime;
                    if (elapsedTime >= currentAction.duration) {
                        isBouncing = false;
                        isActionComplete = true;
                    }
                }
                break;
        }
    } else if (currentAction === 'center') {
        const returnSpeed = 0.02 * speedFactor;
        moveX *= (1 - returnSpeed);
        moveY *= (1 - returnSpeed);
        
        if (Math.abs(moveX) < 0.001 && Math.abs(moveY) < 0.001) {
            moveX = 0;
            moveY = 0;
            isActionComplete = true;
        }
    }

    // Apply scale last
    modelViewMatrix = mult(modelViewMatrix, scale(scaleNum, scaleNum, scaleNum));
    
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    // Handle sequence progression
    if (isActionComplete) {
        currentSequenceIndex++;
        if (currentSequenceIndex >= animationSequence.length) {
            currentSequenceIndex = 0;
            animFlag = false;
            startBtn.value = "Start Animation";
            startBtn.classList.remove('active');
            
            if (backgroundMusic) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0;
            }
            
            // Re-enable panel interaction when animation completes
            togglePanelInteractivity(true);
            return;
        }
        resetActionState();
    }

    if (animFlag) {
        animFrame = window.requestAnimationFrame(animUpdate);
    }
}

// Add these helper functions
function resetAnimationState() {
    moveX = 0;
    moveY = 0;
    XrotationAngle = 0;
    YrotationAngle = 0;
    ZrotationAngle = 0;
    cumulativeRotation = { X: 0, Y: 0, Z: 0 };  // Reset cumulative rotations
    scaleNum = 1;
    targetScale = 1;
    isBouncing = false;
    currentSequenceIndex = 0;
    isPaused = false;
    
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    
    // Ensure panel is enabled when resetting
    togglePanelInteractivity(true);
}

function resetActionState() {
    // Only reset the temporary rotation angles, not the cumulative ones
    XrotationAngle = 0;
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
            duration: 5.0,  // Default duration
            infinite: false  // Start with finite duration
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
                    <div class="bounce-input-group">
                        Bounce for: 
                        <input type="number" class="bounce-value" value="${action.infinite ? '∞' : action.duration}" 
                               min="1" max="20" step="0.5"
                               ${action.infinite ? 'disabled' : ''}
                               onchange="updateBounceValue(${index}, this.value)">s
                        <label class="infinite-checkbox">
                            <input type="checkbox" 
                                   ${action.infinite ? 'checked' : ''} 
                                   onchange="toggleInfiniteBounce(${index}, this.checked)">
                            Infinite
                        </label>
                        <button class="remove-btn" onclick="removeFromSequence(${index})">×</button>
                    </div>
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

// Add new function to toggle infinite bounce
function toggleInfiniteBounce(index, checked) {
    if (typeof animationSequence[index] === 'object' && 
        animationSequence[index].type === 'bounce') {
        animationSequence[index].infinite = checked;
        animationSequence[index].duration = checked ? Infinity : 5.0;
        updateSequenceDisplay();
    }
}

// Modify the togglePanelInteractivity function
function togglePanelInteractivity(enable) {
    const panel = document.querySelector('.panel');
    const interactiveElements = panel.querySelectorAll('button, input, label');
    
    if (enable) {
        // Enable all interactive elements
        interactiveElements.forEach(element => {
            element.style.pointerEvents = 'auto';
        });
        panel.style.opacity = '1';
    } else {
        // Disable all interactive elements but keep panel scrollable
        interactiveElements.forEach(element => {
            element.style.pointerEvents = 'none';
        });
        panel.style.opacity = '0.6';
    }
}

// Add this new function to update bounce duration
function updateBounceValue(index, value) {
    const duration = parseFloat(value) || 5.0;
    if (typeof animationSequence[index] === 'object' && 
        animationSequence[index].type === 'bounce' &&
        !animationSequence[index].infinite) {
        animationSequence[index].duration = duration;
    }
}

