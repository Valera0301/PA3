'use strict';

let gl;                         // Контекст WebGL
let surface;                    // Модель поверхні
let shProgram;                  // Програма шейдерів
let spaceball;                  // TrackballRotator для обертання вигляду

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Конструктор моделі
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer(); // Буфер вершин
    this.iNormalBuffer = gl.createBuffer(); // Буфер нормалей
    this.iTangentBuffer = gl.createBuffer(); // Буфер тангентів
    this.iIndexBuffer = gl.createBuffer();  // Буфер індексів
    this.iTexCoordBuffer = gl.createBuffer(); // Буфер для текстурних координат
    this.count = 0;
    
    // Запис у буфери
    this.BufferData = function(data) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normalList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.tangentList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indexList), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoordList), gl.STATIC_DRAW);
    
        this.count = data.indexList.length;
    };

    // Малювання моделі
    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
        

    };
}

// Конструктор програми шейдерів
function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iLightPosition = -1;
    this.iNormalMatrix = -1;
    this.iAttribTexCoord = gl.getAttribLocation(this.prog, 'inTexCoords');

    // Використання програми шейдерів
    this.Use = function() {
        gl.useProgram(this.prog);
    };
}

// Функція малювання
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Створюємо перспективну матрицю для камери
    let projection = m4.perspective(Math.PI / 8, 1, 1, 60);  // Використовуємо перспективу з кутом 22.5° (Math.PI / 8)

    // Отримуємо матрицю виду, яка описує позицію камери в сцені
    let modelView = spaceball.getViewMatrix();  

    // Створюємо матрицю повороту 
    let rotateToPointZero = m4.axisRotation([1, 0, 0], -Math.PI / 10);  

    // Матриця переміщення
    let translateToPointZero = m4.translation(0, 0, -20);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);  

    let matAccum1 = m4.multiply(translateToPointZero, matAccum0); 

    // Створюємо матрицю modelViewProjection для  перспективи
    let modelViewProjection = m4.multiply(projection, matAccum1); 
    
    // Створюєм матрицю нормалей
    let normalMatrix = calculateNormalMatrix(matAccum1);

    // Відпраляємо modelViewProjection ModelView Normal матриці
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);
    
    // Позиція спостерігача (камери)
    const viewPosition = [0.0, 0.0, 30.0]; // Камера знаходиться за об'єктом
    
    // Параметри освітлення
    // Оновлення позиції світла
    const time = performance.now();
    const lightPosition = updateLightPosition(time);
    const ambientStrength = 0.1; // Сила ambient освітлення
    const specularStrength = 0.3; // Сила спекулярного освітлення
    const shininess = 30.0; // Жорсткість поверхні
    
    // Передача параметрів в шейдер
    gl.uniform3fv(shProgram.iLightPosition, lightPosition);
    gl.uniform3fv(shProgram.iViewPosition, viewPosition);
    gl.uniform1f(shProgram.iAmbientStrength, ambientStrength);
    gl.uniform1f(shProgram.iSpecularStrength, specularStrength);
    gl.uniform1f(shProgram.iShininess, shininess);
    // Малювання поверхні
    
    const surfaceColor = [0.0, 0.0, 1.0, 1.0];
    gl.uniform4fv(shProgram.iColor, surfaceColor);
    surface.Draw();
}

// Функція для обератння світла по колу XY
function updateLightPosition(time) {
    const angle = time * 0.001;
    const h = 5; 
    const r = 10; 

    const x = r * Math.cos(angle);
    const y = h;
    const z = r * Math.sin(angle) - 20; 
    return [x, y, z];
}

// Функція для генерації точки на поверхні
function calculateSurfacePoint(u, v) {
    const cosU = Math.cos(u);
    const cosV = Math.cos(v);

    // Обчислення виразу для Z
    let zExpression = (-3.0 * cosU + -3.0 * cosV) / ( 3.0 + 4.0 * cosU * cosV);

    // Перевірка, чи знаходиться значення в межах допустимого діапазону для arccos
    zExpression = Math.max(-1, Math.min(1, zExpression));  // обмеження значення між -1 і 1

    // Обчислення Z з параметричних рівнянь
    const z = Math.acos(zExpression);
    // Поверхня на основі параметричних рівнянь
    return { x: u, y: v, z: z};
}

// Функція для генерації повної сфери з flat shading
function createFullSurface(uSteps, vSteps) {
    const surface = {
        vertexList: [],
        normalList: [],
        tangentList: [],
        indexList: [],
        texCoordList: []
    };

    const uMin = -Math.PI, uMax = Math.PI;
    const vMin = -Math.PI, vMax = Math.PI;
    const uStep = (uMax - uMin) / uSteps;
    const vStep = (vMax - vMin) / vSteps;

    const vertexMap = [];
    // Додавання вершин
    for (let i = 0; i <= vSteps; i++) {
        vertexMap[i] = [];
        for (let j = 0; j <= uSteps; j++) {
            const u = uMin + j * uStep;
            const v = vMin + i * vStep;

            const p = calculateSurfacePoint(u, v);
            surface.vertexList.push(p.x, p.y, p.z);

            vertexMap[i][j] = surface.vertexList.length / 3 - 1;
        }
    }

    // Генерація трикутників
    for (let i = 0; i < vSteps; i++) {
        for (let j = 0; j < uSteps; j++) {
            const idx1 = vertexMap[i][j];
            const idx2 = vertexMap[i][j + 1];
            const idx3 = vertexMap[i + 1][j];
            const idx4 = vertexMap[i + 1][j + 1];

            surface.indexList.push(idx1, idx2, idx3);
            surface.indexList.push(idx2, idx4, idx3);
        }
    }

    // Обчислення нормалей для всіх вершин
    const vertexCount = surface.vertexList.length / 3;
    for (let i = 0; i < vertexCount; i++) {
        surface.normalList.push(0, 0, 0); // Ініціалізація нормалей
        surface.tangentList.push(0, 0, 0); // Ініціалізація тангентів
    }

    // Flat shading: Обчислення нормалей і тангентів
    for (let t = 0; t < surface.indexList.length; t += 3) {
        const idx1 = surface.indexList[t];
        const idx2 = surface.indexList[t + 1];
        const idx3 = surface.indexList[t + 2];

        const v1 = surface.vertexList.slice(idx1 * 3, idx1 * 3 + 3);
        const v2 = surface.vertexList.slice(idx2 * 3, idx2 * 3 + 3);
        const v3 = surface.vertexList.slice(idx3 * 3, idx3 * 3 + 3);

        const uv1 = surface.texCoordList.slice(idx1 * 2, idx1 * 2 + 2);
        const uv2 = surface.texCoordList.slice(idx2 * 2, idx2 * 2 + 2);
        const uv3 = surface.texCoordList.slice(idx3 * 2, idx3 * 2 + 2);

        // Вектори для обчислення тангенту
        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        // Зміни текстурних координат
        const deltaUV1 = [uv2[0] - uv1[0], uv2[1] - uv1[1]];
        const deltaUV2 = [uv3[0] - uv1[0], uv3[1] - uv1[1]];

        // Обчислення факторів для тангенту
        const r = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);
        const tangent = [
            r * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]),
            r * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]),
            r * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2])
        ];

        // Додаємо тангент для кожної вершини трикутника
        surface.tangentList.push(...tangent, ...tangent, ...tangent);
    }

    // Нормалізація нормалей і тангентів
    for (let i = 0; i < surface.normalList.length; i += 3) {
        const nx = surface.normalList[i];
        const ny = surface.normalList[i + 1];
        const nz = surface.normalList[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

        surface.normalList[i] /= length;
        surface.normalList[i + 1] /= length;
        surface.normalList[i + 2] /= length;
    }

    for (let i = 0; i < surface.tangentList.length; i += 3) {
        const tx = surface.tangentList[i];
        const ty = surface.tangentList[i + 1];
        const tz = surface.tangentList[i + 2];
        const length = Math.sqrt(tx * tx + ty * ty + tz * tz);

        surface.tangentList[i] /= length;
        surface.tangentList[i + 1] /= length;
        surface.tangentList[i + 2] /= length;
    }

    // Текстурні координати
    surface.texCoordList = [];
    for (let i = 0; i <= vSteps; i++) {
        for (let j = 0; j <= uSteps; j++) {
            surface.texCoordList.push(j / uSteps, i / vSteps); // Лінійна прив'язка UV
        }
    }

    return surface;
}

// Розрахунок нормалей через похідні
function calculateNormal(u, v) {
    const du = [1, 0, -4 * Math.PI * Math.sin(2 * Math.PI * u) * Math.cos(2 * Math.PI * v)];
    const dv = [0, 1, -4 * Math.PI * Math.cos(2 * Math.PI * u) * Math.sin(2 * Math.PI * v)];

    // Векторний добуток для нормалі
    const normal = [
        du[1] * dv[2] - du[2] * dv[1],
        du[2] * dv[0] - du[0] * dv[2],
        du[0] * dv[1] - du[1] * dv[0],
    ];

    // Нормалізація вектора нормалі
    const length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    return normal.map((n) => n / length);
}

// Розрахунок матриці нормалей
function calculateNormalMatrix(modelViewMatrix) {
    let normalMatrix = m4.inverse(modelViewMatrix);
    normalMatrix = m4.transpose(normalMatrix);
    return normalMatrix;
}

let lastTime = 0; 
const fps = 30; 
const interval = 1000 / fps; 

// Контроль за частотою кадрів
function frameControl(time) {
    const deltaTime = time - lastTime;
    if (deltaTime >= interval) { 
        lastTime = time - (deltaTime % interval); 
        draw(); 
    }

    requestAnimationFrame(frameControl); 
}

// Ініціалізація та запуск анімації
function startAnimation() {
    requestAnimationFrame(frameControl); // Запускаємо цикл анімації
}

// Оновлення поверхні
function updateSurface() {
    // Отримання значень з html повзунків 
    const uSteps = parseInt(document.getElementById('uGran').value, 10);
    const vSteps = parseInt(document.getElementById('vGran').value, 10);

    // Перевірка на валідність значень
    if (isNaN(uSteps) || isNaN(vSteps) || uSteps <= 0 || vSteps <= 0) {
        console.error("Невалідні значення u,v");
        return;
    }

    // Створення нових даних для поверхні
    const data = createFullSurface(uSteps, vSteps);

    // Оновлення буферів WebGL
    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vertexList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normalList), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iTangentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.tangentList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, surface.iIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indexList), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, surface.iTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.texCoordList), gl.STATIC_DRAW);

    // Оновлення кількості індексів
    surface.count = data.indexList.length;

    // Перемальовування сцени
    draw();
}

function loadTexture(gl, imageUrl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Параметри текстури
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const img = new Image();
    img.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        console.log(`Текстура завантажена ${imageUrl}`);
    };
    img.src = imageUrl;

    return texture;
}

// Ініціалізація WebGL
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, 'inVertex');
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, 'ModelViewProjectionMatrix');
    shProgram.iColor = gl.getUniformLocation(prog, 'color');
    shProgram.iAttribNormal = gl.getAttribLocation(prog, 'inNormal');
    shProgram.iAttribTangent = gl.getAttribLocation(prog, 'inTangent');
    
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, 'ModelViewMatrix');
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, 'NormalMatrix');
    shProgram.iLightPosition = gl.getUniformLocation(prog, 'lightPosition');

    shProgram.iViewPosition = gl.getUniformLocation(prog, 'viewPosition');
    shProgram.iAmbientStrength = gl.getUniformLocation(prog, 'ambientStrength');
    shProgram.iSpecularStrength = gl.getUniformLocation(prog, 'specularStrength');
    shProgram.iShininess = gl.getUniformLocation(prog, 'shininess');
    
    // Завантаження текстур
    const diffuseTexture = loadTexture(gl, 'diffuse.png');
    const specularTexture = loadTexture(gl, 'specular.png');
    const normalTexture = loadTexture(gl, 'normal.png');
    if (!diffuseTexture || !specularTexture || !normalTexture) {
        console.error("Не вдалося завантажити текстури");
        return;
    }
    const diffuseLocation = gl.getUniformLocation(prog, 'diffTexture');
    const specularLocation = gl.getUniformLocation(prog, 'specTexture');
    const normalLocation = gl.getUniformLocation(prog, 'normTexture');

    if (!diffuseLocation || !specularLocation || !normalLocation) {
        console.error("Юніформи текстур не знайдено");
        return;
    }

    // Прив'язка текстур
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    gl.uniform1i(diffuseLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.uniform1i(specularLocation, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(normalLocation, 2);


    // Ініціалізація моделі поверхні
    surface = new Model('Surface');
    surface.BufferData(createFullSurface(25, 25));

    gl.enable(gl.DEPTH_TEST);
}

// Створення програми шейдерів
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error('Помилка компіляції шейдера вершин: ' + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error('Помилка компіляції шейдера фрагментів: ' + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Помилка лінкування програми: ' + gl.getProgramInfoLog(prog));
    }
    return prog;
}

// Ініціалізація
function init() {
    let canvas;
    try {
        canvas = document.getElementById('webglcanvas');
        gl = canvas.getContext('webgl');
        if (!gl) {
            throw 'Браузер не підтримує WebGL';
        }
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML =
            '<p>Перепрошуємо, не вдалося отримати контекст WebGL.</p>';
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById('canvas-holder').innerHTML =
            '<p>Перепрошуємо, не вдалося ініціалізувати контекст WebGL: ' + e + '</p>';
        return;
    }
    spaceball = new TrackballRotator(canvas, draw, 0);
    startAnimation();
}
