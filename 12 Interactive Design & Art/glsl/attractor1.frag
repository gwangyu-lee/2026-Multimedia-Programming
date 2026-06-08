uniform float uTime;
uniform float uInteraction;

vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453);
}

vec3 calcVelocity(vec3 pos, float time, float interaction) {
    float cellScale = mix(1.0, 3.0, interaction);
    float chaos = mix(0.0, 1.0, interaction);
    float repulsion = mix(0.1, 2.0, interaction);
    float timeSpeed = mix(0.2, 2.0, interaction);
    float rotationSpeed = mix(0.0, 3.0, interaction);
    
    vec3 scaledPos = pos * cellScale;
    vec3 cellPos = floor(scaledPos);
    vec3 localPos = fract(scaledPos);
    
    vec3 nearestDir = vec3(0);
    vec3 secondDir = vec3(0);
    float minDist = 10.0;
    float secondDist = 10.0;
    
    for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
            for(int z = -1; z <= 1; z++) {
                vec3 cell = vec3(x, y, z);
                vec3 cellHash = hash3(cellPos + cell);
                vec3 movement = sin(cellHash * 6.28 + time * timeSpeed) * chaos * 0.4;
                vec3 cellCenter = cell + cellHash * 0.5 + movement;
                
                vec3 diff = cellCenter - localPos;
                float d = length(diff);
                
                if(d < minDist) {
                    secondDist = minDist;
                    secondDir = nearestDir;
                    minDist = d;
                    nearestDir = diff;
                } else if(d < secondDist) {
                    secondDist = d;
                    secondDir = diff;
                }
            }
        }
    }
    
    float edge = secondDist - minDist;
    float edgeForce = smoothstep(0.0, 0.3, edge);
    
    vec3 rotAxis = normalize(cross(nearestDir, vec3(0, 1, 0)));
    if(length(rotAxis) < 0.001) {
        rotAxis = vec3(1, 0, 0);
    }
    float rotAngle = rotationSpeed * 0.01;
    mat3 rotation = mat3(
        cos(rotAngle) + rotAxis.x * rotAxis.x * (1.0 - cos(rotAngle)),
        rotAxis.x * rotAxis.y * (1.0 - cos(rotAngle)) - rotAxis.z * sin(rotAngle),
        rotAxis.x * rotAxis.z * (1.0 - cos(rotAngle)) + rotAxis.y * sin(rotAngle),
        
        rotAxis.y * rotAxis.x * (1.0 - cos(rotAngle)) + rotAxis.z * sin(rotAngle),
        cos(rotAngle) + rotAxis.y * rotAxis.y * (1.0 - cos(rotAngle)),
        rotAxis.y * rotAxis.z * (1.0 - cos(rotAngle)) - rotAxis.x * sin(rotAngle),
        
        rotAxis.z * rotAxis.x * (1.0 - cos(rotAngle)) - rotAxis.y * sin(rotAngle),
        rotAxis.z * rotAxis.y * (1.0 - cos(rotAngle)) + rotAxis.x * sin(rotAngle),
        cos(rotAngle) + rotAxis.z * rotAxis.z * (1.0 - cos(rotAngle))
    );
    
    vec3 pushForce = -normalize(nearestDir) * repulsion * (1.0 - edgeForce);
    vec3 edgePull = normalize(secondDir - nearestDir) * edge * chaos;
    vec3 spiralForce = rotation * nearestDir * 0.5 * interaction;
    
    return pushForce + edgePull + spiralForce;
}

void main() {
    const uint id = TDIndex();
    if(id >= TDNumElements())
        return;
    
    vec3 pos = TDIn_P();
    vec3 prevN = TDIn_N();
    float dt = 0.01;
    
    float boundRadius = 3.0;
    float boundStrength = mix(0.05, 0.3, uInteraction);
    
    vec3 velocity = calcVelocity(pos, uTime, uInteraction);
    
    float dist = length(pos);
    if(dist > boundRadius * 0.5) {
        float overflow = (dist - boundRadius * 0.5) / (boundRadius * 0.5);
        vec3 pullBack = -normalize(pos) * overflow * boundStrength;
        velocity += pullBack;
    }
    
    vec3 newPos = pos + velocity * dt;
    if(length(newPos) > boundRadius) {
        newPos = normalize(newPos) * boundRadius;
    }
    
    // N 벡터 계산 (떨림 방지)
    float speed = length(velocity);
    float minSpeed = 0.1;
    
    vec3 targetN;
    if(speed > minSpeed) {
        targetN = -normalize(velocity);
    } else {
        // 속도 낮으면 이전 N 유지
        targetN = prevN;
    }
    
    // 부드러운 보간 (lerp)
    float smoothFactor = mix(0.02, 0.2, smoothstep(0.0, 0.1, speed));
    vec3 newN = normalize(mix(prevN, targetN, smoothFactor));
    
    // 첫 프레임 대비 (prevN이 0일 경우)
    if(length(prevN) < 0.001) {
        newN = vec3(0, 0, -1);
    }
    
    P[id] = newPos;
    N[id] = newN;
}