var querystring = window.location.href.split('?')[1] || "";
if (querystring) {
    var comp = querystring.split("&");
    var groupid = comp[0].split("=")[1];
    if (comp[1]) {
        var shortname = comp[1].split("=")[1];
    }
}

const logError = err => document.querySelector("#msg").textContent = err;

fetch("groups.json")
    .then(r => r.json())
    .then(groups => {
        if (!groupid) {
            document.querySelector("body").appendChild(document.createElement("ol"));
            groupToc(groups, document.querySelector("ol"), "issues.html?groupid=");
        } else {
            fetch("pergroup/" + groupid + ".json")
                .then( r => r.json())
                .then(specs => {
                    if (!shortname) {
                        document.querySelector("title").textContent += " for " + groups[groupid].name;
                        document.querySelector("h1").textContent += " for " + groups[groupid].name;

                        document.querySelector("body").appendChild(document.createElement("ol"));
                        specToc(specs, document.querySelector("ol"), "issues.html?groupdi=" + groupid + "&shortname=");
                    } else {
                        const spec = specs.filter(s => s.shortname === shortname)[0];
                        document.querySelector("title").textContent += " for " + spec.title;
                        document.querySelector("h1").textContent += " for "+ spec.title;
                        fetch("pergroup/" + groupid + "-repo.json")
                            .then(r => r.json())
                            .then(repos => {
                                dashboard(repos[spec.shortlink]);
                            });
                    }
                });
        }
    }).catch(logError);

function dashboard(repoinfo) {
    const issues = repoinfo.issues;
    const repo = repoinfo.repo;
    var margin = {top: 30, right: 50, bottom: 30, left: 50},
        width = 800 - margin.left - margin.right,
        height = 800 - margin.top - margin.bottom;

    // Set the ranges
    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);


    // Define the axes
    var xAxis = d3.axisBottom(x).ticks(10);
    var yAxis = d3.axisLeft(y).ticks(10);

    // Adds the svg canvas
    var svg = d3.select("body")
        .append("svg")
        .attr("width", width + margin.left + margin.right + 300)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")");
    svg.append("g")
        .attr("class", "y axis");

    const addMonth = (date, n) => new Date(new Date(date).setMonth(date.getMonth() + n));

    const dateFormat = d3.timeFormat("%Y-%m-%d") ;
    const parseDate = d3.timeParse("%Y-%m");
    const parseMonth = d3.timeParse("%Y-%m");

    var now = new Date();
    var month6 = addMonth(now, 6);

    var durationColorScheme = d3.scaleLinear().domain([0, 1, 6,  24])
        .range(["#afa", "white", "yellow","red"]);

    const durationColor = (d1, d2) => durationColorScheme((d2-d1) / (30*3600*24*1000));


    var months = {};
    issues.forEach(function(i) {
        const startMonth = i.created_at.slice(0,7);
        const endMonth = i.closed_at ? i.closed_at.slice(0,7) : dateFormat(addMonth(now, 1)).slice(0,7);
        let curMonth = startMonth;
        while (curMonth <= endMonth) {
            if (!months[curMonth])  months[curMonth] = [];
            months[curMonth].push(i);
            curMonth = dateFormat(addMonth(parseMonth(curMonth), 1)).slice(0,7);
        }
    });
    x.domain(d3.extent(Object.keys(months), m => parseDate(m))).nice();
    y.domain([0, d3.max(Object.keys(months).map(k => months[k].length))]).nice();
    svg.select("g.x.axis").call(xAxis);
    svg.select("g.y.axis").call(yAxis);

    svg.append("text")
        .attr("x", -15)
        .attr("y", -10)
        .attr("font-size", 10)
        .text("Open Issues");

    var barWidth = x(parseDate('2015-06')) - x(parseDate('2015-05'));
    svg.selectAll("g.month").data(Object.keys(months)).enter()
        .append("g")
        .attr("class", "month")
        .selectAll("a.issue")
        .data(d =>months[d])
        .enter()
        .append("a")
        .attr("xlink:href", d => 'https://github.com/' + repo.owner + "/" + repo.name + '/issues/' + d.number)
        .attr("class", d => "issue issue" + d.number)
        .append("rect")
        .attr('fill', function(d) { if (d.closed_at && d.closed_at.slice(0,7) == d3.select(this.parentNode.parentNode).datum()) { return "#00f"; } else { return durationColor(parseDate(d.created_at.slice(0,7)), parseDate(d3.select(this.parentNode.parentNode).datum())) ;} })
        .attr("stroke-width", "1")
        .attr("stroke", "#000")
        .attr("x", function(d) { return x(parseDate(d3.select(this.parentNode.parentNode).datum()));})
        .attr("y", (d,i) => y(i + 1))
        .attr("width", barWidth)
        .attr("height", (d,i) => y(i) - y(i + 1))
        .append("title")
        .text(d => d.title);

    var toggle = d3.select("body")
        .append("button")
        .text("Switch to issue trail");

    toggle.on("click", function() {
        if (toggle.text() === "Switch to issue trail") {
            toggle.text("Switch to issue stack");
            drawHistory();
        } else {
            toggle.text("Switch to issue trail");
            drawStack();
        }
    });

    function drawStack() {
        y.domain([0, d3.max(Object.keys(months).map(k => months[k].length))]).nice();
        svg.select("g.y.axis").call(yAxis);
        svg.selectAll("g.month")
            .selectAll("rect")
            .transition().duration(1500)
            .attr("y", (d,i) => y(i + 1))
            .attr("stroke-width", 1)
            .attr("height", (d,i) => y(i) - y(i + 1));
    }
    function drawHistory() {
        y.domain([0, issues.length]).nice();
        svg.select("g.y.axis").call(yAxis);
        svg.selectAll("rect")
           .transition().duration(1500)
            .attr("y", (d) => y(issues.map(i => i.number).indexOf(d.number)))
            .attr("height", height / issues.length)
            .attr("stroke-width", 0);
    }

    [].forEach.call(document.querySelectorAll(".issue"), el => {
        el.addEventListener("mouseout", e => {
            [].forEach.call(document.querySelectorAll(".issue"), el => el.classList.remove("highlight"));
        });
        el.addEventListener("mouseover", e => {
            const issueNumber = el.className.baseVal.split(" ")[1];
            [].forEach.call(document.querySelectorAll("." + issueNumber), el => el.classList.add("highlight"));
        });
    });
}