function goalChart(config) {

    var data = config.data;

    var treeData = new Array();
    var subTreeData = new Array();

    makeTree();

    var region = getDataBoundary(treeData);
    var date_boundary = []; // x-axis boundary
    date_boundary[0] = moment(region[0]).startOf('month').toDate();
    date_boundary[1] = moment(region[1]).endOf('month').toDate();

    var ELEMENT = d3.select(config.element);
    var treeHeight = treeData.length * 120;

    var tick_Height = 40;
    var header_Gap = 10; // gap between header and chart
    var node_padding = 10;
    var margin = { top: 20, right: 50, bottom: 20, left: 50 };
    var total_Width = ELEMENT[0][0].offsetWidth;
    var chart_Width = d3.max([total_Width, 400]) - margin.left - margin.right;
    var total_Height = ELEMENT[0][0].offsetHeight - 10;
    var chart_Height = d3.max([total_Height, 400]) - margin.top - tick_Height - margin.bottom;
    var wheelFlag = false,
        offsetY = 0,
        diff = 0; // diff between wheel and mousemove
    var draggingObject = "";

    var svg = ELEMENT
        .append('div')
        .append("svg")
        .attr("width", total_Width)
        .attr("height", total_Height)

    svg.on("click", function() {
        diff = 0;
    })

    var xScale = d3.time.scale()
        .domain(date_boundary)
        .range([0, chart_Width])

    var yScale = d3.scale.linear()
        .domain([1, treeData.length + 1])
        .range([0, treeHeight]);

    var zoom = d3.behavior.zoom()
        .on("zoom", function(node) {
            update(node)
        })
        .scaleExtent([0.1, 40])
        .x(xScale)

    var drag = d3.behavior.drag()
        .on('dragstart', function(d) {
            draggingObject = d3.event.sourceEvent.target.className.baseVal;
        })
        .on('drag', function(node) {
            update(node)
        })
        .on('dragend', function(d) {
            draggingObject = "";
        })

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("top")
        .ticks(5)
        .tickSize(chart_Height + header_Gap)
        .tickFormat(formatXaxis)

    document.addEventListener("wheel", null, { passive: true });

    draw();

    function makeTree(parentId = null, parentIdx = -1) {
        data.forEach((e, i) => {
            if (e.parentId == parentId) {
                let j = 1,
                    classId = "";
                if (treeData.length == 0) classId = "001";
                treeData.forEach(item => {
                    if (item.parentIdx == parentIdx) j++;
                    classId = j.toString().padStart(3, "0");
                });

                let treeItem = {
                    parentIdx: parentIdx,
                    dataIdx: i,
                    idx: treeData.length,
                    childrens: 0,
                    rootIdx: (parentIdx == -1) ? treeData.length : treeData[parentIdx].rootIdx,
                    classId: (parentIdx == -1) ? classId : treeData[parentIdx].classId + classId,
                    id: e.id,
                    parentId: e.parentId,
                    startAt: e.startAt,
                    endAt: (e.endAt >= e.startAt) ? e.endAt : e.startAt,
                    title: e.title,
                    progress: e.progress,
                    left: e.startAt,
                    right: e.endAt,
                    depths: 0,
                };

                treeData.push(treeItem);

                if (parentIdx == -1) {
                    subTreeData.push(treeData.length - 1);
                } else {
                    treeData[parentIdx].childrens++;
                }

                makeTree(e.id, treeData.length - 1)
            }
        });

        // update subRootTree`s region
        subTreeData.forEach(rootIdx => {
            resetRegion(treeData[rootIdx]);
        });

        // deployment Node
        deploymentNode();
    }

    function getDataBoundary(treeData) {
        let startAt = treeData[0].startAt,
            endAt = treeData[0].endAt;

        treeData.forEach((treeItem, idx) => {
            if (treeItem.startAt < startAt) startAt = treeItem.startAt;
            if (treeItem.endAt > endAt) endAt = treeItem.endAt;
        });

        return [startAt, endAt];
    }

    function formatXaxis(date) {
        var formatDay = d3.time.format("%a %d"),
            formatWeek = d3.time.format("%b %d"),
            formatMonth = function(d) {
                let milli = (d.getTime() - 10000);
                let vanilli = new Date(milli);
                let mon = vanilli.getMonth();
                let yr = vanilli.getFullYear();

                // return appropriate quarter for that month
                if ((mon + 1) % 3 == 0) {
                    return yr + " Q" + parseInt(mon / 3 + 1);
                } else {
                    return d3.time.format("%Y %b")(d);
                }
            },
            formatYear = d3.time.format("%Y");

        return (d3.time.month(date) < date ? (d3.time.week(date) < date ? formatDay : formatWeek) :
            d3.time.year(date) < date ? formatMonth : formatYear)(date);
    }

    function draw() {
        let g = svg.append('g')
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        let h = chart_Height + tick_Height + header_Gap;
        g.append("rect")
            .attr("width", chart_Width)
            .attr("height", h)
            .attr('class', "chart-Block")

        g.append("g")
            .attr("id", "clipTick")
            .append("rect")
            .attr("width", chart_Width)
            .attr("height", tick_Height + header_Gap)
            .attr('class', "tick-Block")

        g.append("rect")
            .attr("class", "zoom-Block")
            .attr("width", chart_Width)
            .attr("height", h)
            .style("visibility", "hidden")
            .attr("pointer-events", "all")
            .call(zoom)

        g.append("g")
            .attr("transform", "translate(0," + h + ")")
            .attr("class", "axis")
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "start")

        g.append("clipPath")
            .attr("id", "clipChart")
            .append("rect")
            .attr("y", tick_Height + header_Gap * 2)
            .attr("width", chart_Width)
            .attr("height", chart_Height - header_Gap * 2);

        g.append("g")
            .attr("class", "chart")
            .attr("clip-path", "url(#clipChart)");

        update();
    }

    function update(node) {
        _update(node)
        drawTree();

        svg.selectAll(".chart .node-Block")
            .call(drag)

        function drawTree() {
            var chart = svg.select("g.chart");
            chart.html("");

            var Blocks = chart.selectAll(".chart")
                .data(treeData)
                .enter()

            Blocks
                .append("g")
                .attr('class', 'node-Block')
                .attr("transform", function(d, i) {
                    return "translate(" + xScale(new Date(d.startAt)) + margin.left + "," +
                        (margin.top + tick_Height + header_Gap + yScale(d.depths)) + ")";
                })
                .call(appendNode)
                .each(function(d, i) {
                    trimTitle(getWidth(d), this, node_padding * 2)
                })

            Blocks
                .append("g")
                .attr('class', 'Connector')
                .attr("transform", function(d, i) {
                    return "translate(0," + (margin.top + tick_Height + header_Gap) + ")";
                })
                .call(appendConnector)

            function appendNode(d, i) {
                this.append('rect')
                    .attr('class', 'node')
                    .attr('fill', 'auto')
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", function(d) {
                        return getActualWidth(d);
                    })
                    .attr("height", 87)
                    .style("cursor", "move")

                this.call(appendResizeHandle)

                this.append('g')
                    .attr("transform", function(d) {
                        return "translate(" + node_padding + ", 0)";
                    })
                    .call(appendTitle)
                    .call(appendDuration)
                    .call(appendProgress)

                function appendTitle(d, i) {
                    this.append('text')
                        .attr('class', 'node-Title')
                        .attr("y", 20)
                        .text(function(d) {
                            return d.title
                        })
                }

                function appendDuration(d, i) {
                    this.append('text')
                        .attr('class', 'node-Duration')
                        .attr('y', 40)
                        .text(function(d) {
                            return "Due" + " " + moment(d.endAt).format("MMM DD,YYYY");
                        })
                        .attr('opacity', function(d) {
                            return Number(getWidth(d) > 200)
                        })
                }

                function appendProgress(d, i) {
                    this.append('rect')
                        .attr('class', 'ProgressBar')
                        .attr('fill', '#ddd')
                        .attr('width', function(d) {
                            return Math.max(0, getActualWidth(d) - 20);
                        })

                    this.append('rect')
                        .attr('class', 'ProgressBar')
                        .attr('fill', '#4975D4')
                        .attr('width', function(d) {
                            return (d.progress * (Math.max(0, getActualWidth(d) - 20))) / 100;
                        })

                    this.selectAll('.ProgressBar')
                        .attr('y', 50)
                        .attr('height', 7)
                        .attr('rx', 5)
                        .attr('ry', 5)
                        .attr('opacity', function(d) {
                            return getActualWidth(d);
                        })

                    this.append('text')
                        .attr('class', 'node-ProNum')
                        .attr('x', 10)
                        .attr('y', 80)
                        .text(function(d) {
                            var proText = d.progress + "%"
                            return proText
                        })
                        .attr('opacity', function(d) {
                            return Number(getWidth(d) > 80)
                        })
                }
            }

            function appendResizeHandle(d, i) {
                this.append('rect')
                    .attr('class', 'left-Handle')
                    .attr('fill', 'auto')
                    .attr("x", -3)
                    .attr('y', 5)
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr("width", 3)
                    .attr("height", 77)
                    .style("cursor", "col-resize")

                this.append('rect')
                    .attr('class', 'right-Handle')
                    .attr('fill', 'auto')
                    .attr('y', 5)
                    .attr("x", function(d) {
                        return getActualWidth(d);
                    })
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr("width", 3)
                    .attr("height", 77)
                    .style("cursor", "col-resize")
            }

            function appendConnector(d) {
                var diagonal = d3.svg.diagonal()
                    .source(function(d, i) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: xScale(new Date(d.startAt)),
                            y: yScale(d.depths) + 43
                        };
                    })
                    .target(function(d, i) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: getActualWidth(p) + xScale(new Date(p.startAt)),
                            y: yScale(p.depths) + 43
                        };
                    })
                    .projection(function(d, i) {
                        let x = d.x;
                        let y = d.y;
                        if (i == 1) { x -= 250, y -= 90; }
                        if (i == 2) { x += 250, y += 90; }

                        return [x, y];
                    });

                this.append('path')
                    .attr('d', diagonal)
            }

            function trimTitle(node_width, node, padding) {
                var textBlock = d3.select(node).select('.node-Title')
                var textLength = textBlock.node().getComputedTextLength(),
                    text = textBlock.text()
                while (textLength > (node_width - padding) && text.length > 0) {
                    text = text.slice(0, -1);
                    textBlock.text(text + '...');
                    textLength = textBlock.node().getComputedTextLength();
                }
            }

            function isVisible(node) {
                var startAt_visible = moment(node.startAt, "MM/DD/YYYY").isBetween(date_boundary[0], date_boundary[1], 'days'),
                    endAt_visible = moment(node.endAt, "MM/DD/YYYY").isBetween(date_boundary[0], date_boundary[1], 'days');

                return startAt_visible || endAt_visible;

            }

            function getWidth(node) {
                let nodeWidth = 0;
                if (endsAfter(node)) {
                    nodeWidth = Math.abs(xScale(new Date(date_boundary[1])) - xScale(new Date(node.startAt)));
                } else if (startsBefore(node)) {
                    nodeWidth = Math.abs(xScale(new Date(date_boundary[0])) - xScale(new Date(node.endAt)));
                } else {
                    nodeWidth = getActualWidth(node);
                }
                return nodeWidth;

                function startsBefore(node) {
                    return moment(node.startAt, "MM/DD/YYYY").isBefore(date_boundary[0])
                }

                function endsAfter(node) {
                    return moment(node.endAt, "MM/DD/YYYY").isAfter(date_boundary[1]);
                }

            }

            function getActualWidth(node) {
                return Math.abs(xScale(new Date(node.endAt)) - xScale(new Date(node.startAt)));
            }

        }

        function _update(node) {
            let e = d3.event;
            if (e == null) return;

            if (e.type === "drag") {
                let p = getParent(node);

                let startAt = moment(xScale.invert(xScale(new Date(node.startAt)) + e.dx), "YYYY-MM-DD").format();
                let endAt = moment(xScale.invert(xScale(new Date(node.endAt)) + e.dx), "YYYY-MM-DD").format();

                if (node.childrens > 0) { // node is subtree
                    // get children`s region
                    let left = -1,
                        right = -1;
                    for (let idx = node.idx; idx < treeData.length; idx++) {
                        if (treeData[idx].parentIdx == node.idx) {
                            if (left == -1) {
                                left = treeData[idx].right;
                                right = treeData[idx].right;
                            } else {
                                if (left > treeData[idx].right) left = treeData[idx].right;
                                if (right < treeData[idx].right) right = treeData[idx].right;
                            }
                        }
                    }

                    // check validate
                    if (draggingObject === "left-Handle") {
                        if (p != null) {
                            if (p != null && startAt <= p.endAt && startAt <= node.endAt && startAt <= left ||
                                p == null && startAt <= left
                            ) {
                                node.startAt = startAt;
                            }
                        }
                    } else if (draggingObject === "right-Handle") {
                        if (p != null && endAt <= p.endAt && endAt >= node.startAt && endAt >= p.startAt && endAt >= right ||
                            p == null && endAt >= right
                        ) {
                            node.endAt = endAt;
                        }
                    } else {
                        if (p != null && endAt >= p.startAt && endAt <= p.endAt && startAt <= left && endAt >= right ||
                            p == null && startAt <= left && endAt >= right) {
                            node.startAt = startAt;
                            node.endAt = endAt;
                        }
                    }
                } else { // node is alone node
                    if (draggingObject === "left-Handle") {
                        if (p != null) {
                            if (startAt <= p.endAt && startAt <= node.endAt) {
                                node.startAt = startAt;
                            }
                        }
                    } else if (draggingObject === "right-Handle") {
                        if (p != null) {
                            if (endAt <= p.endAt && endAt >= node.startAt && endAt >= p.startAt) {
                                node.endAt = endAt;
                            }
                        }
                    } else {
                        if (p != null) {
                            if (endAt >= p.startAt && endAt <= p.endAt) {
                                node.startAt = startAt;
                                node.endAt = endAt;
                            }
                        }
                    }
                }

                // reset parent`s regions
                treeData.forEach(item => {
                    if (item.rootIdx == node.rootIdx) {
                        item.left = item.startAt;
                        item.right = item.endAt;
                    }
                });
                resetRegion(treeData[node.rootIdx]);

                deploymentNode();

                // set data for callabck
                data[node.dataIdx].startAt = node.startAt;
                data[node.dataIdx].endAt = node.endAt;

                config.callback(data[node.dataIdx]);
                // config.callback(node);
            }

            if (e.type === "zoom") {
                // panning y-axia
                if (e.sourceEvent.type === "mousemove") {
                    if (e.sourceEvent.target.className.baseVal != "zoom-Block") {
                        // e.preventEvent();
                        return;
                    }

                    if (wheelFlag) {
                        diff = offsetY - e.translate[1];
                    } else {
                        offsetY = e.translate[1] + diff;
                    }
                    wheelFlag = false;

                    if (offsetY > 0) offsetY = 0;
                    if (offsetY < chart_Height - treeHeight) offsetY = chart_Height - treeHeight;

                    zoom.translate([e.translate[0], offsetY]);
                    yScale.range([offsetY, (offsetY + treeHeight)]);
                }
                if (e.sourceEvent.type === "wheel") {
                    wheelFlag = true;
                }
            }

            svg.select("g.axis").call(xAxis);
        }

    }

    function getParent(node) {
        if (node.parentIdx == -1) return null;
        return treeData[node.parentIdx];
    }

    function deploymentNode() {
        treeData[0].depths = 1;
        for (var idx = 1; idx < treeData.length; idx++) {
            let node = treeData[idx];

            let p = getParent(node);
            let depths = (p == null) ? 1 : p.depths;

            do {
                depths++;
            } while (!canDeployment(node, depths)
                //  &&                depths < node.idx
            );

            treeData[idx].depths = depths;
        }

        function canDeployment(node, depths) {
            // for (let i = node.parentIdx + 1; i < node.idx; i++) {
            //     let b = treeData[i];
            //     if (b.parentId == node.parentId && b.id != node.id) {
            //         if ((b.left <= node.left && b.right >= node.left ||
            //                 b.left >= node.left && b.left <= node.right) &&
            //             getMaxDepths(b) >= depths) {
            //             return false;
            //         }
            //     }
            // }
            // return true;

            let brothers = new Array();
            for (let i = node.parentIdx + 1; i < node.idx; i++) {
                let b = treeData[i];
                if (b.parentId == node.parentId && b.id != node.id) {
                    brothers.push(b);
                }
            }

            let available = 1;
            brothers.forEach(b => {
                if ((b.right < node.left || node.right < b.left) && getMaxDepths(b) >= depths || getMaxDepths(b) < depths) {
                    available *= 1;
                } else {
                    available *= 0;
                }
            });

            return (available == 1);
        }

    }

    function getMaxDepths(root) {
        let depths = root.depths;
        for (let i = root.idx; i < treeData.length; i++) {
            if (treeData[i].classId.substr(0, root.classId.length) == root.classId) {
                if (treeData[i].depths > depths) depths = treeData[i].depths;
            } else {
                break;
            }
        }
        return depths;
    }

    function resetRegion(root) {
        let ret = [{
            left: root.startAt,
            right: root.endAt
        }];

        if (root.childrens == 0) return ret;

        treeData.forEach(item => {
            if (item.rootIdx == root.rootIdx) {
                if (item.parentIdx == root.idx) {
                    let region = resetRegion(item);
                    if (ret.left > region.left) ret.left = region.left;
                    if (ret.right < region.right) ret.right = region.right;
                }
            }
        });

        root.left = ret.left;
        root.right = ret.right;

        return ret;
    }
}