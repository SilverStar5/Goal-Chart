function goalChart(config) {

    var data = config.data;

    var xaxis = d3.time.scale();
    var yaxis = d3.scale.ordinal();
    var xscale = d3.scale.linear();
    var yscale = d3.scale.linear();

    var treeData;
    data.forEach(element => {
        if (element.parentId == null) {
            treeData = new Array();
            makeTree(treeData, element.id)
        }
    });

    // var treeData = new Array();
    // makeTree(treeData);

    var ELEMENT = d3.select(config.element);
    var date_boundary = []; // x-axis boundary
    var offsetY = 0; // y-axis offset
    var preOffsetX = 0;
    var preOffsetY = 0;
    var treeHeight = treeData.length * 120;

    var scalable = false;
    var time_scales = [];
    var minTickWidth = 100;
    var maxTickWidth = 400;
    var tick_Height = 60;
    var header_Gap = 20; // gap between header and chart
    var margin = { top: 20, right: 100, bottom: 50, left: 100 };
    var total_Width = ELEMENT[0][0].offsetWidth;
    var chart_Width = d3.max([total_Width, 400]) - margin.left - margin.right;
    var total_Height = ELEMENT[0][0].offsetHeight;
    var chart_Height = d3.max([total_Height, 400]) - margin.top - tick_Height - margin.bottom - header_Gap;
    // var chart_Height = d3.max([((treeData.length * 120)), 300]);
    // var total_Height = chart_Height + tick_Height + margin.bottom + margin.top;

    var region = getDataBoundary(treeData);
    date_boundary[0] = moment(region[0]).startOf('month').toDate();
    date_boundary[1] = moment(region[1]).endOf('month').toDate();

    var svg = ELEMENT
        .append('div')
        .append("svg")
        .attr("width", total_Width)
        .attr("height", total_Height)

    draw();

    function makeTree(parent, parentId = null) {
        data.forEach(element => {
            if (element.parentId == parentId) {
                parent.push(element)
                makeTree(parent, element.id)
            }
        });
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

    function draw() {
        let g = svg.append('g')
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        let defs = g.append("defs")
        defs.append("clipPath")
            .attr("id", "clipTick")
            .append("rect")
            .attr("width", chart_Width)
            .attr("height", chart_Height + tick_Height + header_Gap)

        defs.append("clipPath")
            .attr("id", "clipChart")
            .append("rect")
            .attr("y", tick_Height + header_Gap)
            .attr("width", chart_Width)
            .attr("height", chart_Height);

        g.append('g')
            .append("rect")
            .attr("width", chart_Width)
            .attr("height", chart_Height + tick_Height + header_Gap)
            .attr('class', "chart-Block")

        g.append("g")
            .attr("class", "tick")
            .attr("clip-path", "url(#clipTick)");

        g.append("g")
            .attr("class", "chart")
            .attr("clip-path", "url(#clipChart)");

        g.append("rect")
            .attr("class", "zoom box")
            .attr("width", chart_Width)
            .attr("height", chart_Height + tick_Height + header_Gap)
            .style("visibility", "hidden")
            .attr("pointer-events", "all")

        svg.on("click", function() {
            preOffsetX = 0;
            preOffsetY = offsetY;

            // let coords = d3.mouse(this);
            // let left = moment(date_boundary[0]);
            // let right = moment(date_boundary[1]);
            // var duration = moment.duration(right.diff(left));
            // x = moment(left.add(Math.round((coords[0] - margin.left) / chart_Width * duration.asDays()), 'days'))
        });

        update();
    }

    function update() {
        if (zoom_update()) {
            setScale();
            drawHeader();
            drawTree();
        }

        function startsBefore(node) {
            return moment(node.startAt, "MM/DD/YYYY").isBefore(date_boundary[0])
        }

        function endsAfter(node) {
            return moment(node.endAt, "MM/DD/YYYY").isAfter(date_boundary[1]);
        }

        function getWidth(node) {
            let nodeWidth = 0;
            if (endsAfter(node)) {
                nodeWidth = Math.abs(xaxis(new Date(date_boundary[1])) - xaxis(new Date(node.startAt)));
            } else if (startsBefore(node)) {
                nodeWidth = Math.abs(xaxis(new Date(date_boundary[0])) - xaxis(new Date(node.endAt)));
            } else {
                nodeWidth = getActualWidth(node);
            }
            return nodeWidth;
        }

        function getActualWidth(node) {
            return Math.abs(xaxis(new Date(node.endAt)) - xaxis(new Date(node.startAt)));
        }

        function setScale() {
            xaxis.domain(date_boundary)
                .range([0, chart_Width])

            yaxis.domain(treeData.map(function(d, i) {
                    return i + 1;
                }))
                .rangeRoundBands([offsetY, offsetY + treeHeight], 0.1);

            let left = moment(date_boundary[0]);
            let right = moment(date_boundary[1]);
            let region = moment.duration(right.diff(left)).asDays();
            let unit = decideTickUnit(region);
            switch (unit) {
                case 'd':
                    time_scales = getDaysRange(date_boundary);
                    break;
                case 'w':
                    time_scales = getWeeksRange(date_boundary);
                    break;
                case 'm':
                    time_scales = getMonthsRange(date_boundary);
                    break;
                case 'q':
                    time_scales = getQuardsRange(date_boundary);
                    break;
                case 'y':
                    time_scales = getYearsRange(date_boundary);
                    break;
                default:
                    break;
            }

            function decideTickUnit(days) {
                let tickWidth = chart_Width / days;

                let w = tickWidth;
                if (w >= maxTickWidth) return 'o';
                if (w >= minTickWidth) return 'd';

                w = tickWidth * 7
                if (w >= minTickWidth && w < maxTickWidth) return 'w';

                w = tickWidth * 30
                if (w >= minTickWidth && w < maxTickWidth) return 'm';

                w = tickWidth * 90
                if (w >= minTickWidth && w < maxTickWidth) return 'q';

                w = tickWidth * 365
                if (w >= minTickWidth && w < maxTickWidth) return 'y';

                return 'o';
            }

            function getDaysRange(boundary) {
                var first = moment(boundary[0]);
                let count = moment(boundary[1]).diff(first, 'days');

                ranges = [];
                for (let i = 0; i <= count; i++) {
                    let node = {
                        name: first.format('YYYY MMM DD'),
                        startAt: first.toDate(),
                    };

                    first.add(1, 'd');

                    node['endAt'] = first.toDate();
                    ranges.push(node);
                }
                return ranges;
            }

            function getWeeksRange(boundary) {
                var first = moment(boundary[0]);
                let count = moment(boundary[1]).diff(first, 'weeks');

                ranges = [{
                    name: first.format('YYYY [W]WW'),
                    startAt: first.toDate(),
                    endAt: first.endOf('week').add(1, 'days').toDate(),
                }];

                for (let i = 0; i <= count; i++) {
                    let node = {
                        name: first.format('YYYY [W]WW'),
                        startAt: first.toDate(),
                    };

                    first.add(1, 'week');

                    node['endAt'] = first.toDate();
                    ranges.push(node);
                }
                return ranges;
            }

            function getMonthsRange(boundary) {
                var first = moment(boundary[0]);
                let count = moment(boundary[1]).diff(first, 'months');

                ranges = [{
                    name: first.format('YYYY MMM'),
                    startAt: first.toDate(),
                    endAt: first.endOf('month').add(1, 'days').toDate(),
                }];

                for (let i = 0; i <= count; i++) {
                    let node = {
                        name: first.format('YYYY MMM'),
                        startAt: first.toDate(),
                    };

                    first.add(1, 'month');

                    node['endAt'] = first.toDate();
                    ranges.push(node);
                }
                return ranges;
            }

            function getQuardsRange(boundary) {
                var first = moment(boundary[0]);
                let count = moment(boundary[1]).diff(first, 'quarters');

                ranges = [{
                    name: first.format('YYYY [Q]Q'),
                    startAt: first.toDate(),
                    endAt: first.endOf('quarter').add(1, 'days').toDate(),
                }];

                for (let i = 0; i <= count; i++) {
                    let node = {
                        name: first.format('YYYY [Q]Q'),
                        startAt: first.toDate(),
                    };

                    first.add(1, 'quarter');

                    node['endAt'] = first.toDate();
                    ranges.push(node);
                }
                return ranges;
            }

            function getYearsRange(boundary) {
                var first = moment(boundary[0]);
                let count = moment(boundary[1]).diff(first, 'years');

                ranges = [{
                    name: first.format('YYYY'),
                    startAt: first.toDate(),
                    endAt: first.endOf('year').add(1, 'days').toDate(),
                }];

                for (let i = 0; i <= count; i++) {
                    let node = {
                        name: first.format('YYYY'),
                        startAt: first.toDate(),
                    };

                    first.add(1, 'year');

                    node['endAt'] = first.toDate();
                    ranges.push(node);
                }
                return ranges;
            }
        }

        function drawHeader() {
            var tick = svg.select("g.tick");
            tick.html("");

            tick.append('g')
                .selectAll(".tick")
                .data(time_scales)
                .enter()
                .append('g')
                .attr("transform", function(d) {
                    return "translate(" + (xaxis(new Date(d.startAt))) + ", 0)";
                })
                .call(appendTick)
                .call(appendLabel)
                .call(appendLine)

            function appendTick() {
                this.append("rect")
                    .attr("x", 0)
                    .attr("width", function(d) {
                        return getWidth(d);
                    })
                    .attr("height", tick_Height)
                    .attr('class', "tick-Block")
            }

            function appendLabel() {
                this.append("text")
                    .attr("x", 25)
                    .attr('y', 35)
                    .attr("width", function(d) {
                        return getWidth(d);
                    })
                    .text(function(d) {
                        return d.name;
                    })
                    .attr('class', "tick-Title");
            }

            function appendLine(d, i) {
                this.append("line")
                    .attr('class', 'tick-Line')
                    .attr("x1", 0)
                    .attr("y1", tick_Height)
                    .attr("x2", 0)
                    .attr("y2", tick_Height + chart_Height + header_Gap)
            }
        }

        function drawTree() {
            var chart = svg.select("g.chart");
            chart.html("");

            var Blocks = chart.selectAll(".chart")
                .data(treeData)
                .enter()
                .append("g")
                .attr('class', 'Single--Block')
                .attr("transform", function(d, i) {
                    // return "translate(" + (margin.left) + ", " + (margin.top + tick_Height + header_Gap) + ")";
                    return "translate(" + xaxis(new Date(d.startAt)) + margin.left + "," + (margin.top + tick_Height + header_Gap) + ")";
                })
                .call(appendBar)
                .call(appendConnector)

            Blocks
                .append('g')
                .attr('transform', function(d) {
                    if (startsBefore(d) && isVisible(d)) {
                        var position = Math.abs(xaxis(new Date(d.startAt)));
                        return "translate(" + position + ", 0)";
                    } else {
                        return "translate(0, 0)";
                    }
                })
                .call(appendTitle)
                .call(appendBody)
                .call(appendFooter)

            Blocks
                .each(function(d, i) {
                    trimTitle(getWidth(d), this, config.box_padding * 2)
                })

            function appendBar(d, i) {
                this.append('rect')
                    .attr('class', 'node-Block')
                    .attr('fill', 'auto')
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr("x", 0)
                    .attr("y", function(d, i) {
                        return yaxis(i + 1);
                    })
                    .attr("width", function(d) {
                        return (getActualWidth(d) + 10);
                    })
                    .attr("height", 87)
            }

            function appendTitle(d, i) {
                this.append('text')
                    .attr('class', 'node-Title')
                    .attr("x", config.box_padding)
                    .attr("y", function(d, i) {
                        return (yaxis(i + 1) + 20)
                    })
                    .text(function(d) {
                        return d.title
                    })
            }

            function appendBody(d, i) {
                this.append('g')
                    .attr("transform", function(d, i) {
                        var position = config.box_padding;
                        if (position < 10) {
                            position = 0;
                        }
                        return "translate(" + position + ", " + (yaxis(i + 1) + 45) + ")";
                    })
                    .call(renderDuration)
                    .call(appendProgressBar)
            }

            function appendFooter(d, i) {
                this.append('g')
                    .attr("transform", function(d, i) {
                        var position = config.box_padding;
                        if (position < 10) {
                            position = 0;
                        }
                        return "translate(" + position + ", " + (yaxis(i + 1) + 80) + ")";
                    })
                    .call(renderPro)
            }

            function appendProgressBar(d, i) {
                this.append('rect')
                    .attr('class', 'ProgressBar')
                    .attr('fill', '#ddd')
                    .attr('width', function(d) {
                        return getActualWidth(d) - 20;
                    })

                this.append('rect')
                    .attr('class', 'ProgressBar')
                    .attr('fill', '#4975D4')
                    .attr('width', function(d) {
                        return (d.progress * (getActualWidth(d) - 20)) / 100;
                    })

                this.selectAll('.ProgressBar')
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr('y', 10)
                    .attr('height', 7)
                    .attr('x', 10)
                    .attr('opacity', function(d) {
                        return getActualWidth(d);
                    })
            }

            function renderPro(d, i) {
                this.append('text')
                    .attr('class', 'node-ProNum')
                    .text(function(d) {
                        var proText = d.progress + "%"
                        return proText
                    })
                    .attr('opacity', function(d) {
                        return Number(getWidth(d) > 80)
                    })
            }

            function renderDuration(d, i) {
                this.append('text')
                    .attr('class', 'node-Duration')
                    .attr('x', 10)
                    .text(function(d) {
                        return "Due" + " " + moment(d.endAt).format("MMM DD,YYYY");
                    })
                    .attr('opacity', function(d) {
                        return Number(getWidth(d) > 200)
                    })
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

            function appendConnector(d) {
                var diagonal = d3.svg.diagonal()
                    .source(function(d) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: 0,
                            y: yaxis(getPos_Y(d)) + 43
                        };
                    })
                    .target(function(d) {
                        p = getParent(d);
                        if (p == null) { return { x: -1000, y: -1000 }; }
                        return {
                            x: getActualWidth(p) + (xaxis(new Date(p.startAt)) - xaxis(new Date(d.startAt))) + 10,
                            y: yaxis(getPos_Y(p)) + 43
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
                    .attr('class', 'Connector')
            }

            function getParent(d) {
                let parent = null
                treeData.forEach((e, i) => {
                    if (e.id == d.parentId) {
                        parent = e;
                    }
                });

                return parent;
            }

            function getPos_Y(d) {
                let y = 0;
                treeData.forEach((e, i) => {
                    if (e.id == d.id) {
                        y = i + 1;
                    }
                });

                return y;
            }
        }

        function zoom_update() {
            let e = d3.event;
            if (e != null) {
                let left = moment(date_boundary[0]);
                let right = moment(date_boundary[1]);
                let region = moment.duration(right.diff(left - 1)).asDays();

                if (e.scale == 1) {
                    // scale x-axis
                    let offset = e.translate[0] - preOffsetX;
                    preOffsetX = e.translate[0];

                    // console.log(e.translate[0], ",", offset);

                    date_boundary[0] = moment(left.subtract(offset * region / chart_Width, 'days'));
                    date_boundary[1] = moment(left.add(region, 'days'));

                    // scale y-axia
                    offsetY = e.translate[1] + preOffsetY;
                    if (offsetY > 0) offsetY = 0;
                    if (offsetY < chart_Height - treeHeight) offsetY = chart_Height - treeHeight;
                } else {
                    right = moment(left.add(region / e.scale, 'days'));
                    region = moment.duration(right.diff(moment(date_boundary[0]) - 1)).asDays();

                    let tickWidth = chart_Width / region;

                    scalable = true;
                    if (e.scale > 1 && tickWidth > maxTickWidth) scalable = false;
                    if (e.scale < 1 && tickWidth * 365 < minTickWidth) scalable = false;

                    if (scalable == true) {
                        date_boundary[0] = moment(date_boundary[0]);
                        date_boundary[1] = moment(right);
                    } else {
                        return false;
                    }

                }
            }

            var zoom = d3.behavior.zoom()
                .x(xscale)
                .on("zoom", update);

            svg.select('rect.zoom.box').call(zoom);
            return true;
        }
    }
}