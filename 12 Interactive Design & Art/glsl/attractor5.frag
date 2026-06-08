uniform float uTime;
uniform float uInteraction;
uniform float uFeedbackDecay;

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;
    
    vec3 prevPos = TDIn_P();
    vec3 prevN = TDIn_N();
    float dt = 0.01;
    
    // interaction 기반 파라미터
    float fieldStrength = mix(0.5, 3.0, uInteraction);
    float magneticStrength = mix(0.3, 2.0, uInteraction);
    float electricStrength = mix(0.2, 1.5, uInteraction);
    float rotationSpeed = mix(0.5, 3.0, uInteraction);
    float chaos = mix(0.0, 0.5, uInteraction);
    float chargeOscillation = mix(0.0, 1.0, uInteraction);
    
    vec3 pos = prevPos;
    float t = uTime * rotationSpeed;
    
    // 전하 위치 (시간에 따라 움직임)
    vec3 charges[4];
    float q[4];
    
    // 양전하
    charges[0] = vec3(sin(t * 0.3) * 2.0, cos(t * 0.2) * 1.0, 0.0);
    charges[1] = vec3(-sin(t * 0.4) * 2.0, -cos(t * 0.25) * 1.0, sin(t * 0.15) * 1.0);
    q[0] = 1.0 + sin(t * chargeOscillation) * 0.5;
    q[1] = 1.0 + cos(t * 1.1 * chargeOscillation) * 0.5;
    
    // 음전하
    charges[2] = vec3(cos(t * 0.35) * 1.5, sin(t * 0.3) * 1.5, cos(t * 0.2) * 1.0);
    charges[3] = vec3(-cos(t * 0.25) * 1.5, -sin(t * 0.35) * 1.5, -sin(t * 0.25) * 1.0);
    q[2] = -1.0 - sin(t * 0.9 * chargeOscillation) * 0.5;
    q[3] = -1.0 - cos(t * 0.8 * chargeOscillation) * 0.5;
    
    // 전기장 계산 (E = kq/r²)
    vec3 E = vec3(0.0);
    for(int i = 0; i < 4; i++) {
        vec3 r = pos - charges[i];
        float d = length(r);
        float falloff = 1.0 / (d * d + 0.1);
        E += q[i] * normalize(r) * falloff * electricStrength;
    }
    
    // 자기장 (쌍극자)
    vec3 dipole1 = vec3(0, 1.5, 0);
    vec3 dipole2 = vec3(0, -1.5, 0);
    vec3 dipoleAxis = vec3(sin(t * 0.5), cos(t * 0.5), 0);
    
    vec3 r1 = pos - dipole1;
    vec3 r2 = pos - dipole2;
    float d1 = length(r1);
    float d2 = length(r2);
    
    vec3 B1 = cross(dipoleAxis, r1) / (d1 * d1 * d1 + 0.1);
    vec3 B2 = -cross(dipoleAxis, r2) / (d2 * d2 * d2 + 0.1);
    vec3 B = (B1 + B2) * magneticStrength;
    
    // 파티클 속도 (이전 프레임 기반)
    vec3 velocity = pos - prevPos;
    if(length(velocity) < 0.001) {
        // 초기 속도 부여
        velocity = normalize(cross(pos, vec3(0, 1, 0))) * 0.1;
    }
    
    // 로렌츠 힘: F = q(E + v × B)
    float particleCharge = sin(float(id) * 0.1) * 0.5 + 0.5; // 파티클마다 다른 전하
    vec3 lorentzForce = particleCharge * (E + cross(velocity, B)) * fieldStrength;
    
    // 카오스 추가
    vec3 chaosForce = vec3(
        sin(pos.y * 5.0 + t * 2.0),
        sin(pos.z * 5.0 + t * 2.3),
        sin(pos.x * 5.0 + t * 1.7)
    ) * chaos * 0.1;
    
    // 중심 인력 (발산 방지)
    float dist = length(pos);
    float boundRadius = 4.0;
    vec3 centerForce = vec3(0.0);
    if(dist > boundRadius * 0.5) {
        float overflow = (dist - boundRadius * 0.5) / boundRadius;
        centerForce = -normalize(pos) * overflow * 0.5;
    }
    
    // 속도 업데이트
    velocity += (lorentzForce + chaosForce + centerForce) * dt;
    
    // 속도 제한
    float maxSpeed = 0.5;
    if(length(velocity) > maxSpeed) {
        velocity = normalize(velocity) * maxSpeed;
    }
    
    // 목표 위치
    vec3 targetPos = pos + velocity;
    
    // Feedback 블렌딩
    float decay = uFeedbackDecay;
    vec3 newPos = mix(targetPos, prevPos, decay);
    
    // 하드 경계
    if(length(newPos) > boundRadius) {
        newPos = normalize(newPos) * boundRadius;
    }
    
    // N 벡터 계산
    vec3 finalVelocity = newPos - prevPos;
    float speed = length(finalVelocity);
    
    vec3 targetN;
    if(speed > 0.001) {
        targetN = -normalize(finalVelocity);
    } else {
        // 정지 시 자기장 방향
        targetN = length(B) > 0.001 ? normalize(B) : prevN;
    }
    
    float smoothFactor = mix(0.02, 0.15, smoothstep(0.0, 0.05, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    if(length(prevN) < 0.001) {
        newN = vec3(0, 0, -1);
    }
    
    P[id] = newPos;
    N[id] = newN;
}
