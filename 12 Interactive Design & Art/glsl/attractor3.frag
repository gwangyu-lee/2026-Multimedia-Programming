uniform float uTime;
uniform float uInteraction;
uniform float uFeedbackDecay; // 0.9 ~ 0.99

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;
    
    vec3 prevPos = TDIn_P();
    vec3 prevN = TDIn_N();
    float dt = 0.01;
    
    // interaction 기반 파라미터
    float waveSpeed = mix(1.0, 5.0, uInteraction);
    float waveFreq = mix(2.0, 8.0, uInteraction);
    float waveAmp = mix(0.2, 1.0, uInteraction);
    float rippleStrength = mix(0.0, 0.5, uInteraction);
    float chaos = mix(0.0, 0.3, uInteraction);
    
    float x = prevPos.x;
    float z = prevPos.z;
    float t = uTime * waveSpeed;
    
    // 다중 파동 중첩
    float wave1 = sin(x * waveFreq + t);
    float wave2 = sin(z * waveFreq * 0.8 - t * 1.2);
    float wave3 = sin((x + z) * waveFreq * 0.5 + t * 0.7);
    
    // 원형 파동
    float dist = length(vec2(x, z));
    float ripple = sin(dist * waveFreq * 1.5 - t * 2.0) * rippleStrength;
    
    // 카오스 노이즈
    float noise = sin(x * 13.0 + z * 17.0 + t * 3.0) * chaos;
    
    // 목표 높이
    float targetY = (wave1 + wave2 + wave3) * waveAmp * 0.33 + ripple + noise;
    
    // Feedback 블렌딩 (이전 위치와 섞기)
    float decay = uFeedbackDecay;
    vec3 pos = prevPos;
    pos.y = mix(targetY, prevPos.y, decay);
    
    // XZ 드리프트 (선택적)
    float drift = mix(0.0, 0.01, uInteraction);
    pos.x += sin(t * 0.5 + z * 2.0) * drift;
    pos.z += cos(t * 0.7 + x * 2.0) * drift;
    
    // 표면 노멀 계산
    float eps = 0.01;
    float yDx = (sin((x + eps) * waveFreq + t) + sin(z * waveFreq * 0.8 - t * 1.2) + sin((x + eps + z) * waveFreq * 0.5 + t * 0.7)) * waveAmp * 0.33;
    float yDxMinus = (sin((x - eps) * waveFreq + t) + sin(z * waveFreq * 0.8 - t * 1.2) + sin((x - eps + z) * waveFreq * 0.5 + t * 0.7)) * waveAmp * 0.33;
    float yDz = (sin(x * waveFreq + t) + sin((z + eps) * waveFreq * 0.8 - t * 1.2) + sin((x + z + eps) * waveFreq * 0.5 + t * 0.7)) * waveAmp * 0.33;
    float yDzMinus = (sin(x * waveFreq + t) + sin((z - eps) * waveFreq * 0.8 - t * 1.2) + sin((x + z - eps) * waveFreq * 0.5 + t * 0.7)) * waveAmp * 0.33;
    
    float dYdX = (yDx - yDxMinus) / (2.0 * eps);
    float dYdZ = (yDz - yDzMinus) / (2.0 * eps);
    
    vec3 surfaceN = normalize(vec3(-dYdX, 1.0, -dYdZ));
    
    // 속도 기반 노멀 블렌딩
    vec3 velocity = pos - prevPos;
    float speed = length(velocity);
    
    vec3 targetN = surfaceN;
    if(speed > 0.001) {
        targetN = normalize(mix(surfaceN, -normalize(velocity), 0.2));
    }
    
    float smoothFactor = mix(0.03, 0.15, smoothstep(0.0, 0.05, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    if(length(prevN) < 0.001) {
        newN = vec3(0, 1, 0);
    }
    
    P[id] = pos;
    N[id] = newN;
}