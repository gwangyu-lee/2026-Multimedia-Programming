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
    float gravity = mix(0.5, 3.0, uInteraction);
    float spin = mix(0.3, 2.0, uInteraction);
    float diskThickness = mix(0.1, 0.5, uInteraction);
    float turbulence = mix(0.0, 0.4, uInteraction);
    float jetStrength = mix(0.0, 1.5, uInteraction);
    float eventHorizon = mix(0.2, 0.5, uInteraction);
    
    vec3 pos = prevPos;
    float t = uTime;
    
    // 블랙홀 중심
    vec3 blackhole = vec3(0.0);
    vec3 toCenter = blackhole - pos;
    float dist = length(toCenter);
    
    // 중력 (역제곱 법칙)
    float gravityStrength = gravity / (dist * dist + 0.01);
    vec3 gravityForce = normalize(toCenter) * gravityStrength;
    
    // 각운동량 보존 (회전)
    vec3 up = vec3(0, 1, 0);
    vec3 orbitAxis = normalize(cross(toCenter, up));
    if(length(orbitAxis) < 0.001) {
        orbitAxis = vec3(1, 0, 0);
    }
    
    // 케플러 회전 (거리에 따라 속도 변화)
    float orbitalSpeed = spin * sqrt(gravity / (dist + 0.1));
    vec3 orbitForce = orbitAxis * orbitalSpeed;
    
    // 디스크 평면으로 끌어당김
    float diskPull = pos.y * diskThickness * 2.0;
    vec3 diskForce = vec3(0, -diskPull, 0);
    
    // 난류
    vec3 turbForce = vec3(
        sin(pos.z * 8.0 + t * 3.0 + float(id) * 0.01),
        sin(pos.x * 8.0 + t * 2.7 + float(id) * 0.02),
        sin(pos.y * 8.0 + t * 3.3 + float(id) * 0.015)
    ) * turbulence * 0.1;
    
    // 제트 (극 방향 분출)
    vec3 jetForce = vec3(0.0);
    float polarAngle = abs(pos.y) / (dist + 0.01);
    if(polarAngle > 0.7 && dist < 1.5) {
        float jetPower = (polarAngle - 0.7) * jetStrength;
        jetForce = vec3(0, sign(pos.y) * jetPower, 0);
    }
    
    // 사건의 지평선 (빨려들어감)
    vec3 spiralForce = vec3(0.0);
    if(dist < eventHorizon * 3.0) {
        float spiralStrength = (1.0 - dist / (eventHorizon * 3.0)) * 0.5;
        spiralForce = normalize(toCenter) * spiralStrength;
        
        // 더 빠른 회전
        orbitForce *= (1.0 + spiralStrength * 2.0);
    }
    
    // 총 힘
    vec3 totalForce = gravityForce * 0.3 + orbitForce + diskForce + turbForce + jetForce + spiralForce;
    
    // 속도 업데이트
    vec3 velocity = pos - prevPos;
    velocity += totalForce * dt;
    
    // 속도 제한
    float maxSpeed = 0.8;
    if(length(velocity) > maxSpeed) {
        velocity = normalize(velocity) * maxSpeed;
    }
    
    // 목표 위치
    vec3 targetPos = pos + velocity;
    
    // 사건의 지평선 내부 처리 (리스폰)
    if(length(targetPos) < eventHorizon) {
        // 외곽에서 다시 생성
        float angle = float(id) * 2.399 + t * 0.1; // 황금각
        float radius = mix(2.0, 4.0, fract(sin(float(id) * 43758.5453)));
        targetPos.x = cos(angle) * radius;
        targetPos.y = (fract(sin(float(id) * 12345.67)) - 0.5) * diskThickness;
        targetPos.z = sin(angle) * radius;
    }
    
    // Feedback 블렌딩
    float decay = uFeedbackDecay;
    vec3 newPos = mix(targetPos, prevPos, decay);
    
    // 외곽 경계
    float boundRadius = 5.0;
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
        targetN = normalize(orbitAxis);
    }
    
    float smoothFactor = mix(0.02, 0.15, smoothstep(0.0, 0.05, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    if(length(prevN) < 0.001) {
        newN = vec3(0, 0, -1);
    }
    
    P[id] = newPos;
    N[id] = newN;
}