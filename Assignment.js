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
var scaleSlider, scaleText;
var maxScale = 2.0; // Default max scale value

// Add to variable declarations section
var timerSlider, timerText;
var bounceTimer = 5.0; // Default bounce time in seconds
var bounceStartTime = 0;
var isBouncing = false;

// Add to variable declarations
var XrotateCheckbox;
var XshouldRotate = true;

// Add to variable declarations
var XrotationSlider, XrotationText;
var XnumRotations = 1;

// Add to variable declarations
var YrotateCheckbox, ZrotateCheckbox;
var YshouldRotate = true, ZshouldRotate = true;
var YrotationSlider, ZrotationSlider;
var YrotationText, ZrotationText;
var YnumRotations = 1, ZnumRotations = 1;
var YrotationAngle = 0, ZrotationAngle = 0;

// Add to variable declarations
var currentRotationAxis = 'X'; // Track which axis is currently rotating


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

    speedSlider.onchange = function(event) {
        animationSpeed = parseFloat(event.target.value);
        speedText.innerHTML = animationSpeed.toFixed(1);
        recompute();
    };

    startBtn.onclick = function() {
        animFlag = !animFlag;
        if(animFlag) {
            startBtn.value = "Stop Animation";
            startBtn.classList.add('active');
            animUpdate();
        } else {
            startBtn.value = "Start Animation";
            startBtn.classList.remove('active');
            window.cancelAnimationFrame(animFrame);
        }
    };

    // Add subdivision slider handler
    subdivSlider.onchange = function(event) {
        subdivide = parseInt(event.target.value);
        subdivText.innerHTML = subdivide;
        recompute();
    };

    // You might also want to add an input event for real-time updates
    subdivSlider.oninput = function(event) {
        subdivText.innerHTML = event.target.value;
    };

    scaleSlider = document.getElementById("scale-slider");
    scaleText = document.getElementById("scale-text");

    scaleSlider.onchange = function(event) {
        maxScale = parseFloat(event.target.value);
        scaleText.innerHTML = maxScale.toFixed(1);
        recompute();
    };

    // You might also want to add an input event for real-time updates
    scaleSlider.oninput = function(event) {
        scaleText.innerHTML = parseFloat(event.target.value).toFixed(1);
    };

    timerSlider = document.getElementById("timer-slider");
    timerText = document.getElementById("timer-text");

    timerSlider.onchange = function(event) {
        bounceTimer = parseFloat(event.target.value);
        timerText.innerHTML = bounceTimer.toFixed(1);
    };

    timerSlider.oninput = function(event) {
        timerText.innerHTML = parseFloat(event.target.value).toFixed(1);
    };

    XrotateCheckbox = document.getElementById("rotate-checkbox");
    XrotationSlider = document.getElementById("rotation-slider");
    XrotationText = document.getElementById("rotation-text");
    const rotationContainer = document.getElementById("rotation-slider-container");

    XrotateCheckbox.onchange = function(event) {
        XshouldRotate = event.target.checked;
        // Show/hide rotation slider based on checkbox
        rotationContainer.style.display = XshouldRotate ? "block" : "none";
    };

    XrotationSlider.onchange = function(event) {
        XnumRotations = parseInt(event.target.value);
        XrotationText.innerHTML = XnumRotations;
    };

    XrotationSlider.oninput = function(event) {
        XrotationText.innerHTML = event.target.value;
    };

    // Add Y and Z rotation controls
    YrotateCheckbox = document.getElementById("rotate-y-checkbox");
    ZrotateCheckbox = document.getElementById("rotate-z-checkbox");
    YrotationSlider = document.getElementById("rotation-y-slider");
    ZrotationSlider = document.getElementById("rotation-z-slider");
    YrotationText = document.getElementById("rotation-y-text");
    ZrotationText = document.getElementById("rotation-z-text");
    const rotationYContainer = document.getElementById("rotation-y-slider-container");
    const rotationZContainer = document.getElementById("rotation-z-slider-container");

    YrotateCheckbox.onchange = function(event) {
        YshouldRotate = event.target.checked;
        rotationYContainer.style.display = YshouldRotate ? "block" : "none";
    };

    ZrotateCheckbox.onchange = function(event) {
        ZshouldRotate = event.target.checked;
        rotationZContainer.style.display = ZshouldRotate ? "block" : "none";
    };

    YrotationSlider.onchange = function(event) {
        YnumRotations = parseInt(event.target.value);
        YrotationText.innerHTML = YnumRotations;
    };

    ZrotationSlider.onchange = function(event) {
        ZnumRotations = parseInt(event.target.value);
        ZrotationText.innerHTML = ZnumRotations;
    };

    YrotationSlider.oninput = function(event) {
        YrotationText.innerHTML = event.target.value;
    };

    ZrotationSlider.oninput = function(event) {
        ZrotationText.innerHTML = event.target.value;
    };
}

// Configure WebGL Settings
function configWebGL()
{
    // Initialize the WebGL context
    gl = WebGLUtils.setupWebGL(canvas);
    
    if(!gl)
    {
        alert("WebGL isn't available");
    }

    // Set the viewport and clear the color
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

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
    const currentTime = performance.now() / 1000; // Convert to seconds

    // Initialize bounce start time when entering state 5
    if (animationState === 5 && !isBouncing) {
        bounceStartTime = currentTime;
        isBouncing = true;
    }

    // Check if bounce time has expired
    if (isBouncing && currentTime - bounceStartTime >= bounceTimer) {
        // If any rotation is enabled, go to state 6 (return to center)
        if (XshouldRotate || YshouldRotate || ZshouldRotate) {
            animationState = 6;
            isBouncing = false;
            rotationAngle = 0;
            YrotationAngle = 0;
            ZrotationAngle = 0;
        } else {
            // Go directly to smooth return without rotation
            animationState = 6;
            isBouncing = false;
        }
    }

    // State 0: Rotate right 180 degrees
    if (animationState === 0) {
        rotationAngle += 2 * speedFactor;
        if (rotationAngle >= 180) {
            animationState = 1;
            rotationAngle = 180;
        }
    }
    // State 1: Rotate back to center from right
    else if (animationState === 1) {
        rotationAngle -= 2 * speedFactor;
        if (rotationAngle <= 0) {
            animationState = 2;
            rotationAngle = 0;
        }
    }
    // State 2: Rotate left 180 degrees
    else if (animationState === 2) {
        rotationAngle -= 2 * speedFactor;
        if (rotationAngle <= -180) {
            animationState = 3;
            rotationAngle = -180;
        }
    }
    // State 3: Rotate back to center from left
    else if (animationState === 3) {
        rotationAngle += 2 * speedFactor;
        if (rotationAngle >= 0) {
            animationState = 4;
            rotationAngle = 0;
            scaleNum = 1;
        }
    }
    // State 4: Scale up
    else if (animationState === 4) {
        scaleNum += 0.02 * speedFactor;
        if (scaleNum >= maxScale) {
            animationState = 5;
            scaleNum = maxScale;
            bounceAngle = Math.random() * Math.PI * 2;
        }
    }
    // Modified State 5: Circular boundary movement with timer
    else if (animationState === 5) {
        const moveSpeed = 0.03 * speedFactor;
        const nextX = moveX + Math.cos(bounceAngle) * moveSpeed;
        const nextY = moveY + Math.sin(bounceAngle) * moveSpeed;
        
        if (Math.abs(nextX) > BOUNCE_WIDTH) {
            bounceAngle = Math.PI - bounceAngle;
            bounceAngle += (Math.random() - 0.5) * 0.2;
        }
        if (Math.abs(nextY) > BOUNCE_HEIGHT) {
            bounceAngle = -bounceAngle;
            bounceAngle += (Math.random() - 0.5) * 0.2;
        }
        
        moveX += Math.cos(bounceAngle) * moveSpeed;
        moveY += Math.sin(bounceAngle) * moveSpeed;
    }
    // New State 6: Return to original position
    else if (animationState === 6) {
        const returnSpeed = 0.02 * speedFactor;
        
        moveX = moveX * (1 - returnSpeed);
        moveY = moveY * (1 - returnSpeed);
        scaleNum = 1 + (scaleNum - 1) * (1 - returnSpeed);

        if (Math.abs(moveX) < 0.001 && 
            Math.abs(moveY) < 0.001 && 
            Math.abs(scaleNum - 1) < 0.001) {
            moveX = 0;
            moveY = 0;
            scaleNum = 1;
            
            // Check if any rotation is enabled
            if (XshouldRotate || YshouldRotate || ZshouldRotate) {
                rotationAngle = 0;
                YrotationAngle = 0;
                ZrotationAngle = 0;
                animationState = 7;  // Go to rotation state
            } else {
                // End animation if no rotation is enabled
                animationState = 0;
                animFlag = false;
                startBtn.value = "Start Animation";
                startBtn.classList.remove('active');
                render();
                return;
            }
        }
    }
    // State 7: Perform X-axis rotation
    else if (animationState === 7) {
        const rotationSpeed = 2 * speedFactor;
        let isCurrentRotationComplete = false;

        // Handle X axis rotation first
        if (currentRotationAxis === 'X') {
            if (XshouldRotate) {
                rotationAngle += rotationSpeed;
                if (rotationAngle >= 360 * XnumRotations) {
                    isCurrentRotationComplete = true;
                    rotationAngle = 360 * XnumRotations;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(rotationAngle, 1, 0, 0));
            } else {
                isCurrentRotationComplete = true;
            }

            if (isCurrentRotationComplete) {
                currentRotationAxis = 'Y';
                rotationAngle = 0;
            }
        }
        // Then handle Y axis rotation
        else if (currentRotationAxis === 'Y') {
            if (YshouldRotate) {
                YrotationAngle += rotationSpeed;
                if (YrotationAngle >= 360 * YnumRotations) {
                    isCurrentRotationComplete = true;
                    YrotationAngle = 360 * YnumRotations;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(YrotationAngle, 0, 1, 0));
            } else {
                isCurrentRotationComplete = true;
            }

            if (isCurrentRotationComplete) {
                currentRotationAxis = 'Z';
                YrotationAngle = 0;
            }
        }
        // Finally handle Z axis rotation
        else if (currentRotationAxis === 'Z') {
            if (ZshouldRotate) {
                ZrotationAngle += rotationSpeed;
                if (ZrotationAngle >= 360 * ZnumRotations) {
                    isCurrentRotationComplete = true;
                    ZrotationAngle = 360 * ZnumRotations;
                }
                modelViewMatrix = mult(modelViewMatrix, rotate(ZrotationAngle, 0, 0, 1));
            } else {
                isCurrentRotationComplete = true;
            }

            if (isCurrentRotationComplete) {
                // All rotations are complete
                animationState = 0;
                animFlag = false;
                currentRotationAxis = 'X'; // Reset for next animation
                rotationAngle = 0;
                YrotationAngle = 0;
                ZrotationAngle = 0;
                startBtn.value = "Start Animation";
                startBtn.classList.remove('active');
                render();
                return;
            }
        }
    }

    // Apply transformations
    modelViewMatrix = mult(modelViewMatrix, translate(moveX, moveY, 0));
    modelViewMatrix = mult(modelViewMatrix, scale(scaleNum, scaleNum, scaleNum));
    
    // Apply Z rotation only for states 0-6
    if (animationState <= 6) {
        modelViewMatrix = mult(modelViewMatrix, rotateZ(rotationAngle));
    }
    
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    if (animFlag) {
        animFrame = window.requestAnimationFrame(animUpdate);
    }
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
