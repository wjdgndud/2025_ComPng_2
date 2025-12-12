// graph.js
import { listenForGraphData } from "./pollData.js";

const container = document.getElementById("network");
const resetBtn = document.getElementById("reset-filter-btn");

let network = null;
let globalTagColorMap = {}; // 색상 정보 전역 저장

const BOX_THRESHOLD = 2; // 박스(Box) 태그 최소 빈도수

// 해시 색상 생성 (파스텔톤)
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 45%)`; 
}

// vis-network 옵션
const options = {
    nodes: {
        borderWidth: 2,
        shadow: true,
        font: { face: "arial" }
    },
    edges: {
        width: 2,
        color: { color: "#CFD8DC", highlight: "#607D8B" },
        smooth: { type: "continuous" }
    },
    physics: {
        stabilization: false,
        barnesHut: { 
            gravitationalConstant: -6000, 
            springConstant: 0.02, 
            springLength: 140 
        }
    },
    interaction: { hover: true }
};

// 그래프 데이터 수신 및 그리기
listenForGraphData((polls) => {
    drawTopicNetwork(polls);
});

// 노드-에지 그래프 그리기
function drawTopicNetwork(polls) {
    const nodesMap = new Map();
    const edgesMap = new Map();
    const tagCounts = {}; 

    // --- 1. 전체 태그 빈도수 집계 ---
    polls.forEach(poll => {
        (poll.tags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // --- 2. 부모/자식 관계 재정립 (빈도수 기반 Sorting) ---
    const realParentsSet = new Set(); // 박스(Box)가 될 태그들
    const tagColorMap = {};           // 태그별 색상 저장

    polls.forEach(poll => {
        let tags = [...(poll.tags || [])]; // 원본 배열 복사
        if (tags.length === 0) return;

        // 빈도수가 높은 순서대로 태그 재정렬
        tags.sort((a, b) => {
            const countDiff = tagCounts[b] - tagCounts[a]; // 빈도수 내림차순
            if (countDiff !== 0) return countDiff;
            return a.localeCompare(b); // 빈도수 같으면 가나다순 (일관성 유지)
        });

        // 정렬 후 첫 번째 태그가 이 그룹의 부모가 됨
        const parent = tags[0];
        
        // 자식이 있거나(>1), 빈도수가 높으면(>=3) 박스 처리
        if (tags.length > 1 || tagCounts[parent] >= BOX_THRESHOLD) {
            realParentsSet.add(parent);
        }

        // 색상 할당 (부모 색상 생성 -> 자식들에게 상속)
        if (!tagColorMap[parent]) {
            tagColorMap[parent] = stringToColor(parent);
        }
        const parentColor = tagColorMap[parent];

        // 자식들(1번 인덱스부터) 처리
        for (let i = 1; i < tags.length; i++) {
            const child = tags[i];
            // 자식은 아직 색이 없으면 부모 색을 따름
            if (!tagColorMap[child]) {
                tagColorMap[child] = parentColor;
            }
        }
    });

    // 빈도수 높은 순으로 정렬되지 않은 태그들(고립된 태그 등) 색상 채우기
    Object.keys(tagCounts).forEach(tag => {
        if (!tagColorMap[tag]) tagColorMap[tag] = stringToColor(tag);
    });
    
    globalTagColorMap = tagColorMap; // 전역 저장

    // --- 3. 노드 생성 ---
    Object.keys(tagCounts).forEach(tag => {
        const count = tagCounts[tag];
        const isRealParent = realParentsSet.has(tag);
        const color = tagColorMap[tag];

        if (isRealParent) {
            // [BOX] 빈도수가 높아 대장으로 선정된 태그
            nodesMap.set(tag, { 
                id: tag, 
                label: tag, 
                shape: "box", 
                color: { background: color, border: color },
                font: { 
                    size: 20 + (count * 1.5), 
                    color: "#ffffff", 
                    face: "bold arial" 
                },
                margin: 10,
                value: 50 + count
            });
        } else {
            // [DOT] 빈도수가 낮아 하위로 들어간 태그
            nodesMap.set(tag, { 
                id: tag, 
                label: tag, 
                shape: "dot",
                color: color, 
                size: 15 + (count * 3), // 인기가 많아지면 닷도 커짐
                font: { 
                    size: 14, 
                    color: "#333", 
                    strokeWidth: 4, 
                    strokeColor: "#ffffff" 
                }
            });
        }
    });

    // --- 4. 에지 생성 (재정렬된 기준으로 연결) ---
    polls.forEach(poll => {
        let tags = [...(poll.tags || [])];
        // 에지 연결할 때도 빈도수 순서대로 정렬
        tags.sort((a, b) => {
            const diff = tagCounts[b] - tagCounts[a];
            return diff !== 0 ? diff : a.localeCompare(b);
        });

        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                const source = tags[i]; // 빈도수 높은 쪽 (부모)
                const target = tags[j]; // 빈도수 낮은 쪽 (자식)
                const edgeId = `${source}-${target}`; // 방향성 있게 ID 생성
                
                if (!edgesMap.has(edgeId)) {
                    edgesMap.set(edgeId, { from: source, to: target });
                }
            }
        }
    });

    const data = { 
        nodes: new vis.DataSet(Array.from(nodesMap.values())), 
        edges: new vis.DataSet(Array.from(edgesMap.values())) 
    };
    
    if (network) network.destroy();
    network = new vis.Network(container, data, options);

    network.on("click", (params) => {
        if (params.nodes.length > 0) filterPollsByTag(params.nodes[0]);
    });
}

// 특정 태그로 필터링
function filterPollsByTag(targetTag) {
    const allPolls = document.querySelectorAll(".poll-container");
    resetBtn.style.display = "inline-block";

    allPolls.forEach(div => {
        const tagsAttr = div.getAttribute("data-tags"); 
        const tags = tagsAttr ? tagsAttr.split(",") : [];

        if (tags.includes(targetTag)) {
            div.style.display = "flex"; 
            const color = globalTagColorMap[targetTag] || stringToColor(targetTag);
            div.style.border = `2px solid ${color}`;
        } else {
            div.style.display = "none";
            div.style.border = "1px solid #ddd";
        }
    });
}

// 리셋 버튼 클릭 시 필터 해제
resetBtn.addEventListener("click", () => {
    document.querySelectorAll(".poll-container").forEach(d => {
        d.style.display = "flex";
        d.style.border = "1px solid #ddd";
    });
    resetBtn.style.display = "none";
    if (network) network.unselectAll();
});