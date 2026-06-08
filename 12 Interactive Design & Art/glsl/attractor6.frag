uniform float uTime;
uniform float uInteraction;
uniform float uFeedbackDecay;

vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    return mix(mix(mix(dot(hash3(i), f),
                       dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;
    
    vec3 prevPos = TDIn_P();
    vec3 prevN = TDIn_N();
    float dt = 0.01;
    
    // interaction 기반 파라미터
    float vortexStrength = mix(0.3, 2.0, uInteraction);
    float noiseScale = mix(0.5, 2.0, uInteraction);
    float noiseSpeed = mix(0.2, 1.0, uInteraction);
    float vortexCount = mix(1.0, 4.0, uInteraction);
    float upwelling = mix(0.0, 0.5, uInteraction);
    float viscosity = mix(0.98, 0.85, uInteraction);
    
    vec3 pos = prevPos;
    float t = uTime;
    
    // 다중 소용돌이 중심
    vec3 totalVortex = vec3(0.0);
    
    for(int i = 0; i < 4; i++) {
        if(float(i) >= vortexCount) break;
        
        float angle = float(i) * 1.5708 + t * 0.2;
        float radius = 1.5 + sin(t * 0.3 + float(i)) * 0.5;
        
        vec3 vortexCenter = vec3(
            cos(angle) * radius,
            sin(t * 0.5 + float(i) * 0.7) * 0.5,
            sin(angle) * radius
        );
        
        vec3 toVortex = pos - vortexCenter;
        float dist = length(toVortex);
        
        // 소용돌이 회전 (거리에 따라 감소)
        float falloff = exp(-dist * 0.5);
        vec3 vortexAxis = vec3(0, 1, 0);
        vec3 tangent = normalize(cross(vortexAxis, toVortex));
        
        // 회전 방향 번갈아가며
        float direction = mod(float(i), 2.0) * 2.0 - 1.0;
        
        totalVortex += tangent * falloff * vortexStrength * direction;
        
        // 중심으로 당기는 힘
        totalVortex += normalize(toVortex) * falloff * 0.1 * direction;
    }
    
    // Curl Noise
    vec3 noisePos = pos * noiseScale + t * noiseSpeed;
    float eps = 0.01;
    vec3 curl;
    curl.x = noise(noisePos + vec3(0,eps,0)) - noise(noisePos - vec3(0,eps,0))
           - noise(noisePos + vec3(0,0,eps)) + noise(noisePos - vec3(0,0,eps));
    curl.y = noise(noisePos + vec3(0,0,eps)) - noise(noisePos - vec3(0,0,eps))
           - noise(noisePos + vec3(eps,0,0)) + noise(noisePos - vec3(eps,0,0));
    curl.z = noise(noisePos + vec3(eps,0,0)) - noise(noisePos - vec3(eps,0,0))
           - noise(noisePos + vec3(0,eps,0)) + noise(noisePos - vec3(0,eps,0));
    curl = curl / (2.0 * eps) * 0.3;
    
    // 상승류 (위로 밀어올림)
    float height = pos.y;
    vec3 upForce = vec3(0, (1.0 - height * 0.3) * upwelling, 0);
    
    // 경계 복원력
    float dist = length(pos);
    float boundRadius = 3.5;
    vec3 boundForce = vec3(0.0);
    if(dist > boundRadius * 0.6) {
        float overflow = (dist - boundRadius * 0.6) / boundRadius;
        boundForce = -normalize(pos) * overflow * 0.3;
    }
    
    // 속도 업데이트
    vec3 velocity = pos - prevPos;
    velocity *= viscosity; // 점성
    velocity += (totalVortex + curl + upForce + boundForce) * dt;
    
    // 속도 제한
    float maxSpeed = 0.4;
    if(length(velocity) > maxSpeed) {
        velocity = normalize(velocity) * maxSpeed;
    }
    
    // 목표 위치
    vec3 targetPos = pos + velocity;
    
    // Feedback 블렌딩
    float decay = uFeedbackDecay;
    vec3 newPos = mix(targetPos, prevPos, decay);
    
    // 경계 클램프
    if(length(newPos) > boundRadius) {
        newPos = normalize(newPos) * boundRadius;
    }
    newPos.y = clamp(newPos.y, -2.0, 3.0);
    
    // N 벡터 계산
    vec3 finalVelocity = newPos - prevPos;
    float speed = length(finalVelocity);
    
    vec3 targetN;
    if(speed > 0.001) {
        targetN = -normalize(finalVelocity);
    } else {
        targetN = normalize(totalVortex + vec3(0.001));
    }
    
    float smoothFactor = mix(0.02, 0.12, smoothstep(0.0, 0.04, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    if(length(prevN) < 0.001) {
        newN = vec3(0, 0, -1);
    }
    
    P[id] = newPos;
    N[id] = newN;
}
