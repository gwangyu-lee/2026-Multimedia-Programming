uniform float uSmoothK;
uniform float uSphereSize;

float sdSphere(vec3 p, vec3 center, float r) {
    return length(p - center) - r;
}

// smin과 동일한 비율로 컬러도 블렌딩
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// SDF + Color를 동시에 smooth blend
// blendedCol을 inout으로 누적
float sceneSDF(vec3 p, out vec3 blendedCol) {
    float d = 1e9;
    blendedCol = vec3(0.0);

    ivec2 res = textureSize(sTD2DInputs[0], 0);

    for (int y = 0; y < res.y; y++) {
        for (int x = 0; x < res.x; x++) {
            vec3 center = texelFetch(sTD2DInputs[0], ivec2(x, y), 0).rgb;
            vec3 col    = texelFetch(sTD2DInputs[1], ivec2(x, y), 0).rgb;
            float d2 = sdSphere(p, center, uSphereSize);
            float h = clamp(0.5 + 0.5 * (d2 - d) / uSmoothK, 0.0, 1.0);
            blendedCol = mix(col, blendedCol, h);
            d = mix(d2, d, h) - uSmoothK * h * (1.0 - h);
        }
    }
    return d;
}

vec3 calcNormal(vec3 p) {
    vec3 dummy;
    vec2 e = vec2(0.001, -0.001);
    return normalize(
        e.xyy * sceneSDF(p + e.xyy, dummy) +
        e.yyx * sceneSDF(p + e.yyx, dummy) +
        e.yxy * sceneSDF(p + e.yxy, dummy) +
        e.xxx * sceneSDF(p + e.xxx, dummy)
    );
}

layout(location = 0) out vec4 fragColor;

void main() {
    float aspect = uTDOutputInfo.res.z / uTDOutputInfo.res.w;
    // 중심 기준 -0.5~0.5
    vec2 uv = vUV.st - 0.5;  
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv.x * aspect, uv.y, -1.5));



    float t   = 0.0;
    bool  hit = false;
    vec3  surfaceCol = vec3(1.0);

	// 128 → 64
    for (int i = 0; i < 128; i++) {
        vec3  p = ro + rd * t;
        vec3  c;
        float d = sceneSDF(p, c);
        // 0.001 → 0.002
        if (d < 0.001) {
            hit = true;
            // hit 지점의 블렌딩된 컬러 저장
            surfaceCol = c;
            break;
        }
        // 20.0 → 10.0
        if (t > 20.0) break;
        t += d;
    }

    vec3 col = vec3(0.05);
    if (hit) {
        vec3  p     = ro + rd * t;
        vec3  n     = calcNormal(p);
        vec3  light = normalize(vec3(1.0, 1.5, 2.0));
        float diff  = max(dot(n, light), 0.0);
        float spec  = pow(max(dot(reflect(-light, n), -rd), 0.0), 32.0);
        // surfaceCol에 조명 적용
        col = surfaceCol * (0.2 + diff * 0.7) + vec3(spec * 0.5);
    }

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}