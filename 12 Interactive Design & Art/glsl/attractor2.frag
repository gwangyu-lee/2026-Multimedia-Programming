uniform float uTime;
uniform float uInteraction;
uniform float uMode; // 0.0: 기본, 0.5: 나선형, 1.0: 구면 (블렌딩)

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;
    
    vec3 prevN = TDIn_N();
    float dt = 0.01;
    
    float t = float(id) * 0.001 + uTime * mix(0.2, 1.5, uInteraction);
    
    // interaction 기반 파라미터
    float freqA = mix(2.0, 7.0, uInteraction);
    float freqB = mix(3.0, 5.0, uInteraction);
    float freqC = mix(4.0, 9.0, uInteraction);
    
    float phaseA = mix(0.0, 3.14159, uInteraction);
    float phaseB = mix(1.57, 2.5, uInteraction);
    float phaseC = mix(0.78, 4.0, uInteraction);
    
    float amplitude = mix(1.5, 2.5, uInteraction);
    float chaos = mix(0.0, 0.3, uInteraction);
    
    // 기본 Lissajous
    vec3 basePos;
    basePos.x = sin(freqA * t + phaseA);
    basePos.y = sin(freqB * t + phaseB);
    basePos.z = sin(freqC * t + phaseC);
    
    // 카오스 추가
    basePos.x += sin(t * 17.0 + float(id) * 0.1) * chaos;
    basePos.y += sin(t * 23.0 + float(id) * 0.2) * chaos;
    basePos.z += sin(t * 19.0 + float(id) * 0.15) * chaos;
    
    basePos *= amplitude;
    
    // 나선형 변형
    vec3 spiralPos = basePos;
    float spiral = t * mix(0.05, 0.3, uInteraction);
    float spiralRadius = mix(0.2, 1.0, uInteraction);
    spiralPos.x += cos(spiral) * spiralRadius;
    spiralPos.z += sin(spiral) * spiralRadius;
    
    // 구면 변형
    vec3 spherePos;
    float r = mix(1.5, 2.5, uInteraction) + sin(t * 3.0) * 0.3 * uInteraction;
    spherePos = normalize(basePos) * r;
    
    // 모드 블렌딩
    // 0.0 = 기본, 0.5 = 나선형, 1.0 = 구면
    vec3 pos;
    if(uMode <= 0.5) {
        float blend = uMode * 2.0; // 0~0.5 -> 0~1
        pos = mix(basePos, spiralPos, blend);
    } else {
        float blend = (uMode - 0.5) * 2.0; // 0.5~1.0 -> 0~1
        pos = mix(spiralPos, spherePos, blend);
    }
    
    // 경계
    float boundRadius = 3.5;
    if(length(pos) > boundRadius) {
        pos = normalize(pos) * boundRadius;
    }
    
    // 속도 계산 (다음 프레임)
    float tNext = t + dt;
    
    vec3 baseNext;
    baseNext.x = sin(freqA * tNext + phaseA);
    baseNext.y = sin(freqB * tNext + phaseB);
    baseNext.z = sin(freqC * tNext + phaseC);
    baseNext.x += sin(tNext * 17.0 + float(id) * 0.1) * chaos;
    baseNext.y += sin(tNext * 23.0 + float(id) * 0.2) * chaos;
    baseNext.z += sin(tNext * 19.0 + float(id) * 0.15) * chaos;
    baseNext *= amplitude;
    
    vec3 spiralNext = baseNext;
    float spiralN = tNext * mix(0.05, 0.3, uInteraction);
    spiralNext.x += cos(spiralN) * spiralRadius;
    spiralNext.z += sin(spiralN) * spiralRadius;
    
    vec3 sphereNext;
    float rNext = mix(1.5, 2.5, uInteraction) + sin(tNext * 3.0) * 0.3 * uInteraction;
    sphereNext = normalize(baseNext) * rNext;
    
    vec3 posNext;
    if(uMode <= 0.5) {
        float blend = uMode * 2.0;
        posNext = mix(baseNext, spiralNext, blend);
    } else {
        float blend = (uMode - 0.5) * 2.0;
        posNext = mix(spiralNext, sphereNext, blend);
    }
    
    vec3 velocity = posNext - pos;
    
    // N 벡터 (떨림 방지)
    float speed = length(velocity);
    float minSpeed = 0.001;
    
    vec3 targetN;
    if(speed > minSpeed) {
        targetN = -normalize(velocity);
    } else {
        targetN = prevN;
    }
    
    float smoothFactor = mix(0.02, 0.15, smoothstep(0.0, 0.05, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    if(length(prevN) < 0.001) {
        newN = vec3(0, 0, -1);
    }
    
    P[id] = pos;
    N[id] = newN;
}