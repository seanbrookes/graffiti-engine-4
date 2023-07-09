<script setup>
const props = defineProps(['post', 'max'])

  const dataId = `viz_${props.post.id}`;

  // console.log('|');
  // console.log('|    WTF props.max ', props.max);
  // console.log('|');

  const renderViz = () => {
    const width = 20;
    const height = 20;
    // const marginTop = 2;
    // const marginRight = 2;
    // const marginBottom = 3;
    // const marginLeft = 2;

    // Declare the x (horizontal position) scale.
    // const x = d3.scaleLinear()
    //     .domain([0,200])
    //     .range([marginLeft, width - marginRight]);

    // Declare the y (vertical position) scale.
    const yScale = d3.scaleLinear()
        .domain([0, props.max])
        .range([0, height - 6]);

    // Create the SVG container.
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height);

    // Add the y-axis.
    // svg.append("g")
    //     .attr("transform", `translate(${marginLeft},0)`)
    //     .call(d3.axisLeft(yScale));

    const count = props.post.characterCount;
    const heightVal = yScale(count);
 
    svg.append('rect')
      .attr('x', 0)       // set the left hand side to 0
      .attr('y', 0)
      .attr('height', heightVal) 
      .attr('fill', 'darkblue')
      .attr('width', width);


    const selectorString = `#${dataId}`;
    // Append the SVG element.
    const container = document.getElementById(dataId);
    if (container) {
      container.append(svg.node());
    }
  };

  setTimeout(() => {
    renderViz();
  }, 2000);


</script>
<template>
  <div data-id="size_viz_container" :id="dataId"></div>
</template>
<style scoped>

[data-id="size_viz_container"] {
  padding: 0;
  margin: 0;
  display: grid;
  align-items: center;
  justify-content: center;
}

</style>